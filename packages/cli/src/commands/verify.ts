import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

import { ENV_MAPPING, parseEnvFile, REQUIRED_KEYS } from "../utils/config.js";
import {
  checkForgejoReachability,
  checkForgejoApiAuthentication,
  checkRepoAccess,
} from "../utils/forgejo-checks.js";
import { CommandConfig } from "../cli-router.js";

interface VerifyOptions {
  diagnostic?: boolean;
}

interface CheckResult {
  name: string;
  success: boolean;
  message?: string;
}

function loadConfig(): Record<string, string> | null {
  const envPath = path.join(process.cwd(), ".env");

  try {
    return parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      p.cancel(`${c.red("Error:")} .env file not found in ${process.cwd()}`);
      process.exitCode = 1;
      return null;
    }
    throw error;
  }
}

function getMissingKeys(config: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!config[key]) {
      missing.push(key.replace(/(?<=[a-z])(?=[A-Z])/g, "_").toUpperCase());
    }
  }
  return missing;
}

async function runDiagnosticMode(
  config: Record<string, string>,
  missing: string[],
): Promise<void> {
  const results: CheckResult[] = [];

  if (missing.length > 0) {
    results.push({
      name: "Required config",
      success: false,
      message: `Missing: ${missing.join(", ")}`,
    });
  }

  for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
    const value = config[configKey];
    results.push({
      name: envKey,
      success: !!value,
      message: value ? "configured" : "missing",
    });
  }

  const forgejoResults = await runForgejoChecks(config);
  const allResults = [...results, ...forgejoResults];

  const lines = allResults.map((r) => {
    const icon = r.success ? c.green("✓") : c.red("✗");
    const msg = r.message ? ` ${r.message}` : "";
    return `${icon} ${r.name}${msg}`;
  });

  p.note(lines.join("\n"), c.yellow("Results"));

  const failures = allResults.filter((r) => !r.success);
  if (failures.length > 0) {
    p.outro(c.red(`${failures.length} issue(s) found`));
    process.exitCode = 1;
    return;
  }

  p.outro(c.green("All checks passed"));
}

async function runVerifyMode(
  config: Record<string, string>,
  missing: string[],
): Promise<void> {
  if (missing.length > 0) {
    p.cancel(
      `${c.red("Error:")} Missing required env variables: ${missing.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const s = p.spinner();
  s.start("Verifying Forgejo configuration");

  const forgejoResults = await runForgejoChecks(config);

  const firstFailure = forgejoResults.find((r) => !r.success);
  if (firstFailure) {
    s.stop(firstFailure.message);
    p.cancel(`${c.red("✗")} ${firstFailure.name}: ${firstFailure.message}`);
    process.exitCode = 1;
    return;
  }

  if (forgejoResults.length === 0) {
    s.stop("No Forgejo configuration");
    p.cancel(`${c.red("Error:")} Forgejo not configured`);
    process.exitCode = 1;
    return;
  }

  s.stop("Verification complete");

  const [reachability, auth, repoAccess] = forgejoResults;

  p.note(
    [
      `${c.green("✓")} ${reachability.name}`,
      `${c.green("✓")} ${auth.name}: ${auth.message}`,
      `${c.green(repoAccess.success ? "✓" : "✗")} ${repoAccess.name}: ${repoAccess.message}`,
    ].join("\n"),
    c.yellow("Results"),
  );

  p.outro(c.green("Verification passed"));
}

async function runForgejoChecks(
  config: Record<string, string>,
): Promise<CheckResult[]> {
  const { forgejoBaseUrl, forgejoPat, forgejoBotUsername } = config;

  if (!forgejoBaseUrl || !forgejoPat || !forgejoBotUsername) {
    return [];
  }

  const results: CheckResult[] = [];

  const reachability = await checkForgejoReachability(forgejoBaseUrl);
  results.push(reachability);

  if (!reachability.success) {
    return results;
  }

  const auth = await checkForgejoApiAuthentication(forgejoBaseUrl, forgejoPat);
  results.push(auth);

  if (!auth.success) {
    return results;
  }

  const repoAccess = await checkRepoAccess(
    forgejoBaseUrl,
    forgejoPat,
    forgejoBotUsername,
  );
  results.push(repoAccess);

  return results;
}

async function verifyCommand(opts: VerifyOptions): Promise<void> {
  const isDiagnostic = opts.diagnostic ?? false;
  p.intro(c.bold("myst verify"));

  const config = loadConfig();
  if (!config) {
    return;
  }

  const missing = getMissingKeys(config);

  if (isDiagnostic) {
    await runDiagnosticMode(config, missing);
  } else {
    await runVerifyMode(config, missing);
  }
}

export const commandConfig: CommandConfig = {
  description: "Verify Myst configuration and connection to Forgejo",
  options: {
    diagnostic: {
      type: "boolean",
      description: "Show diagnostic information for all checks",
    },
  },
  handler: verifyCommand,
};
