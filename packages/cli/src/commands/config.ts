import fs from "node:fs";
import path from "node:path";

import * as c from "yoctocolors";

interface MystConfig {
  publicUrl?: string;
  adminUrl?: string;
  databaseUrl?: string;
  forgejoBaseUrl?: string;
  forgejoBotUsername?: string;
  forgejoPat?: string;
  grantTokenSecret?: string;
}

function redactSecret(value: string | undefined): string {
  if (!value) return c.dim("not set");
  if (value.length <= 4) return c.dim("****");
  return value.slice(0, 4) + c.dim("****");
}

function parseEnvFile(envPath: string): MystConfig {
  const config: MystConfig = {};

  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!key) continue;

    const value = valueParts.join("=").trim();

    switch (key) {
      case "MYST_PUBLIC_URL":
        config.publicUrl = value;
        break;
      case "MYST_ADMIN_URL":
        config.adminUrl = value;
        break;
      case "DATABASE_URL":
        config.databaseUrl = value;
        break;
      case "FORGEJO_BASE_URL":
        config.forgejoBaseUrl = value;
        break;
      case "FORGEJO_BOT_USERNAME":
        config.forgejoBotUsername = value;
        break;
      case "FORGEJO_PAT":
        config.forgejoPat = value;
        break;
      case "GRANT_TOKEN_SECRET":
        config.grantTokenSecret = value;
        break;
    }
  }

  return config;
}

export async function configCommand(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env");

  let config: MystConfig;

  try {
    config = parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      process.stderr.write(
        `${c.red("Error:")} .env file not found in ${process.cwd()}\n`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  process.stdout.write(c.bold("Myst Configuration\n"));
  process.stdout.write(`${c.dim("─".repeat(40))}\n`);

  process.stdout.write(`${c.bold("MYST_PUBLIC_URL:")} ${config.publicUrl || c.dim("not set")}\n`);
  process.stdout.write(`${c.bold("MYST_ADMIN_URL:")} ${config.adminUrl || c.dim("not set")}\n`);
  process.stdout.write(`${c.bold("DATABASE_URL:")} ${config.databaseUrl || c.dim("not set")}\n`);
  process.stdout.write(`${c.bold("FORGEJO_BASE_URL:")} ${config.forgejoBaseUrl || c.dim("not set")}\n`);
  process.stdout.write(`${c.bold("FORGEJO_BOT_USERNAME:")} ${config.forgejoBotUsername || c.dim("not set")}\n`);
  process.stdout.write(`${c.bold("FORGEJO_PAT:")} ${redactSecret(config.forgejoPat)}\n`);
  process.stdout.write(`${c.bold("GRANT_TOKEN_SECRET:")} ${redactSecret(config.grantTokenSecret)}\n`);

  process.exitCode = 0;
}
