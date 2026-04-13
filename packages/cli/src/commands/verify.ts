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

async function verifyCommand(opts: VerifyOptions): Promise<void> {
  const isDiagnostic = opts.diagnostic ?? false;
  p.intro(c.bold("myst config verify"));

  const config = loadConfig();
  const results: CheckResult[] = collectResults(config);

  if (isDiagnostic) {
    await displayDiagnosticResults(results, config);
  } else {
    await verifyResults(results, config);
  }
}

function loadConfig(): Partial<MystEnvironmentVariables> {
  const envPath = path.join(process.cwd(), ".env");

  try {
    return parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      p.cancel(`${c.red("Error:")} .env file not found in ${process.cwd()}`);
      process.exitCode = 1;
    }
    throw error;
  }
}

function collectResults(
  config: Partial<MystEnvironmentVariables>,
): CheckResult[] {
  const results: CheckResult[] = [];

  function addResult(name: string, success: boolean, message?: string) {
    results.push({ name, success, ...(message !== undefined && { message }) });
  }

  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!config[key]) {
      missing.push(key.replace(/(?<=[a-z])(?=[A-Z])/g, "_").toUpperCase());
    }
  }

  if (missing.length > 0) {
    addResult("Required config", false, `Missing: ${missing.join(", ")}`);
  }

  for (const [, configKey] of Object.entries(ENV_MAPPING)) {
    const value = config[configKey];
    addResult(`${configKey} set`, !!value, value ? "configured" : "missing");
  }

  if (config.databaseUrl) {
    const isDbValid = validateDatabaseUrl(config.databaseUrl);
    addResult("Database URL format", isDbValid, isDbValid ? "valid" : "invalid");
  }

  const isConfigured =
    config.forgejoBaseUrl && config.forgejoPat && config.forgejoBotUsername;

  if (!isConfigured) {
    return results;
  }

  const { forgejoBaseUrl, forgejoPat, forgejoBotUsername } = config;

  addResult("Forgejo configured", true);

  return results;
}

async function runForgejoChecks(config: Partial<MystEnvironmentVariables>): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const { forgejoBaseUrl, forgejoPat, forgejoBotUsername } = config;

  if (!forgejoBaseUrl || !forgejoPat || !forgejoBotUsername) {
    return results;
  }

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

async function displayDiagnosticResults(
  results: CheckResult[],
  config: Partial<MystEnvironmentVariables>,
): Promise<void> {
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

async function verifyResults(
  results: CheckResult[],
  config: Partial<MystEnvironmentVariables>,
): Promise<void> {
  const failures = results.filter((r) => !r.success);

  if (failures.length > 0) {
    const msg = failures[0]?.message ?? "Unknown error";
    p.cancel(`${c.red("Error:")} ${msg}`);
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

  if (forgejoResults.length < 3) {
    s.stop("No Forgejo configuration");
    p.cancel(`${c.red("Error:")} Forgejo not configured`);
    process.exitCode = 1;
    return;
  }

  s.stop("Verification complete");

  const reachability = forgejoResults[0]!;
  const auth = forgejoResults[1]!;
  const repoAccess = forgejoResults[2]!;

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

export const commandConfig: CommandConfig = {
  description: "Verify Myst configuration and connection to Forgejo",
  options: {
    diagnostic: { type: "boolean", description: "Show diagnostic information for all checks" },
  },
  handler: verifyCommand,
};