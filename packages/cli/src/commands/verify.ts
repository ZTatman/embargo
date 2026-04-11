import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";
import { MystEnvironmentVariables, parseEnvFile, REQUIRED_KEYS } from "../config.js";

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
      message: `Authenticated as ${user.login}`,
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

async function checkRepoAccess(
  baseUrl: string,
  pat: string,
  username: string,
): Promise<CheckResult> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/users/${username}/repos?limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${pat}`,
        },
      },
    );

    if (!response.ok) {
      return {
        name: "Repo access",
        success: false,
        message: `HTTP ${response.status}`,
      };
    }

    const repos = (await response.json()) as { name: string }[];
    if (repos.length > 0) {
      return {
        name: "Repo access",
        success: true,
        message: `Found ${repos.length} repo(s)`,
      };
    }

    return {
      name: "Repo access",
      success: true,
      message: "No repos found (service account may not have repo access)",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Repo access",
      success: false,
      message,
    };
  }
}

export async function verifyCommand(): Promise<void> {
  p.intro(c.bold("myst verify"));

  const envPath = path.join(process.cwd(), ".env");

  let config: Partial<MystEnvironmentVariables>;

  try {
    config = parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      p.cancel(
        `${c.red("Error:")} .env file not found in ${process.cwd()}`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const missing: string[] = [];

  for (const key of REQUIRED_KEYS) {
    if (!config[key]) {
      const envKey = Object.entries({
        forgejoBaseUrl: "FORGEJO_BASE_URL",
        forgejoBotUsername: "FORGEJO_BOT_USERNAME",
        forgejoPat: "FORGEJO_PAT",
      }).find(([, v]) => v === key)?.[0];
      if (envKey) missing.push(envKey);
    }
  }

  if (missing.length > 0) {
    p.cancel(
      `${c.red("Error:")} Missing required config: ${missing.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const s = p.spinner();

  try {
    s.start("Verifying Forgejo configuration");

    const reachability: CheckResult = await checkForgejoReachability(
      config.forgejoBaseUrl!,
    );

    if (!reachability.success) {
      s.stop(reachability.message);
      p.cancel(`${c.red("✗")} ${reachability.name}: ${reachability.message}`);
      process.exitCode = 1;
      return;
    }

    const apiToken: CheckResult = await checkForgejoApi(
      config.forgejoBaseUrl!,
      config.forgejoPat!,
    );

    if (!apiToken.success) {
      s.stop(apiToken.message);
      p.cancel(`${c.red("✗")} ${apiToken.name}: ${apiToken.message}`);
      process.exitCode = 1;
      return;
    }

    const repoAccess = await checkRepoAccess(
      config.forgejoBaseUrl!,
      config.forgejoPat!,
      config.forgejoBotUsername!,
    );

    s.stop("Verification complete");

    p.note(
      [
        `${c.green("✓")} ${reachability.name}`,
        `${c.green("✓")} ${apiToken.name}: ${apiToken.message}`,
        `${c.green(repoAccess.success ? "✓" : "✗")} ${repoAccess.name}: ${repoAccess.message}`,
      ].join("\n"),
      c.yellow("Results"),
    );

    if (!repoAccess.success) {
      process.exitCode = 1;
      return;
    }

    p.outro(c.green("Forgejo verification passed"));
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : "Unknown error";
    p.cancel(`${c.red("Error:")} ${message}`);
    process.exitCode = 1;
  }
}