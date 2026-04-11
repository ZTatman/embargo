import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";
import { ENV_MAPPING, MystEnvironmentVariables, parseEnvFile, validateDatabaseUrl, REQUIRED_KEYS } from "../config.js";

type CheckResult = {
  name: string;
  success: boolean;
  message?: string;
};

async function checkForgejoReachability(baseUrl: string): Promise<CheckResult> {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (response.ok || response.status === 200) {
      return { name: "Forgejo reachability", success: true };
    }
    return {
      name: "Forgejo reachability",
      success: false,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Forgejo reachability",
      success: false,
      message,
    };
  }
}

async function checkForgejoApi(
  baseUrl: string,
  pat: string,
): Promise<CheckResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
      },
    });

    if (response.status === 401) {
      return {
        name: "Forgejo API token",
        success: false,
        message: "Invalid or expired token",
      };
    }

    if (!response.ok) {
      return {
        name: "Forgejo API token",
        success: false,
        message: `HTTP ${response.status}`,
      };
    }

    const user = (await response.json()) as { login: string };
    return {
      name: "Forgejo API token",
      success: true,
      message: `Authenticated as ${c.green(user.login)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Forgejo API token",
      success: false,
      message,
    };
  }
}

export async function doctorCommand(): Promise<void> {
  p.intro(c.bold("myst doctor"));

  const envPath = path.join(process.cwd(), ".env");
  const results: CheckResult[] = [];

  let config: Partial<MystEnvironmentVariables>;

  try {
    config = parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      p.cancel(`${c.red("Error:")} .env file not found in ${process.cwd()}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  function addResult(name: string, success: boolean, message?: string) {
    results.push({ name, success, ...(message && { message }) });
  }

  addResult("Config file exists", true, envPath);

  for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
    const value = config[configKey];
    addResult(`${envKey} set`, !!value, value ? "configured" : "missing");
  }

  if (config.databaseUrl) {
    const valid = validateDatabaseUrl(config.databaseUrl);
    addResult("Database URL format", valid, valid ? "valid" : "invalid");
  }

  if (config.forgejoBaseUrl && config.forgejoPat) {
    const reachability = await checkForgejoReachability(config.forgejoBaseUrl);
    results.push(reachability);

    if (reachability.success) {
      const apiToken = await checkForgejoApi(
        config.forgejoBaseUrl,
        config.forgejoPat,
      );
      results.push(apiToken);
    }
  }

  const s = p.spinner();

  try {
    s.start("Running diagnostics");

    s.stop("Diagnostics complete");

    const lines = results.map((r) => {
      const icon = r.success ? c.green("✓") : c.red("✗");
      const msg = r.message ? ` ${r.message}` : "";
      return `${icon} ${r.name}${msg}`;
    });

    p.note(lines.join("\n"), c.yellow("Results"));

    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      p.outro(c.red(`${failures.length} issue(s) found`));
      process.exitCode = 1;
      return;
    }

    p.outro(c.green("All checks passed"));
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : "Unknown error";
    p.cancel(`${c.red("Error:")} ${message}`);
    process.exitCode = 1;
  }
}