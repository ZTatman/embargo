import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

import {
  ENV_MAPPING,
  MystEnvironmentVariables,
  parseEnvFile,
  validateDatabaseUrl,
  REQUIRED_KEYS,
} from "../utils/config.js";
import {
  checkForgejoReachability,
  checkForgejoApi,
  checkRepoAccess,
} from "../utils/forgejo-checks.js";
import { CommandConfig } from "../cli-router.js";

interface VerifyOptions {
  diagnostic?: boolean;
}

async function verifyCommand(opts: VerifyOptions): Promise<void> {
  const diagnostic = opts.diagnostic ?? false;
  p.intro(c.bold("myst config verify"));

  const envPath = path.join(process.cwd(), ".env");

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

  const results: { name: string; success: boolean; message?: string }[] = [];

  function addResult(name: string, success: boolean, message?: string) {
    results.push({ name, success, ...(message !== undefined && { message }) });
  }

  if (diagnostic) {
    addResult("Config file exists", true, envPath);

    for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
      const value = config[configKey];
      addResult(`${envKey} set`, !!value, value ? "configured" : "missing");
    }

    if (config.databaseUrl) {
      const valid = validateDatabaseUrl(config.databaseUrl);
      addResult("Database URL format", valid, valid ? "valid" : "invalid");
    }
  }

  const forgejoConfigured =
    config.forgejoBaseUrl && config.forgejoPat && config.forgejoBotUsername;

  if (forgejoConfigured && config.forgejoBaseUrl && config.forgejoPat) {
    const reachability = await checkForgejoReachability(config.forgejoBaseUrl);
    results.push(reachability);

    if (reachability.success) {
      const apiToken = await checkForgejoApi(
        config.forgejoBaseUrl,
        config.forgejoPat,
        diagnostic,
      );
      results.push(apiToken);

      if (apiToken.success && config.forgejoBotUsername) {
        const repoAccess = await checkRepoAccess(
          config.forgejoBaseUrl,
          config.forgejoPat,
          config.forgejoBotUsername,
        );
        results.push(repoAccess);
      }
    }
  }

  const s = p.spinner();

  try {
    if (diagnostic) {
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
    } else {
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

      s.start("Verifying Forgejo configuration");

      const reachability = await checkForgejoReachability(
        config.forgejoBaseUrl!,
      );

      if (!reachability.success) {
        s.stop(reachability.message);
        p.cancel(`${c.red("✗")} ${reachability.name}: ${reachability.message}`);
        process.exitCode = 1;
        return;
      }

      const apiToken = await checkForgejoApi(
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

      p.outro(c.green("Verification passed"));
    }
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : "Unknown error";
    p.cancel(`${c.red("Error:")} ${message}`);
    process.exitCode = 1;
  }
}

export const commandConfig: CommandConfig = {
  description: "Verify Myst configuration and connection to Forgejo",
  options: {
    diagnostic: { type: "boolean" },
  },
  handler: verifyCommand,
};
