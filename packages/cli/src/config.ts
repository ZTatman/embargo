import fs from "node:fs";

export interface MystEnvironmentVariables {
  publicUrl: string;
  adminUrl: string;
  databaseUrl: string;
  forgejoBaseUrl: string;
  forgejoBotUsername: string;
  forgejoPat: string;
  grantTokenSecret: string;
}

export const ENV_MAPPING = {
  MYST_PUBLIC_URL: "publicUrl",
  MYST_ADMIN_URL: "adminUrl",
  DATABASE_URL: "databaseUrl",
  FORGEJO_BASE_URL: "forgejoBaseUrl",
  FORGEJO_BOT_USERNAME: "forgejoBotUsername",
  FORGEJO_PAT: "forgejoPat",
  GRANT_TOKEN_SECRET: "grantTokenSecret",
} as const;

export const REQUIRED_KEYS = [
  "forgejoBaseUrl",
  "forgejoBotUsername",
  "forgejoPat",
] as const;

export const DATABASE_PROTOCOLS = ["postgres:", "postgresql:"] as const;

export type EnvKey = keyof typeof ENV_MAPPING;
export type ConfigKey = (typeof ENV_MAPPING)[EnvKey];

export function parseEnvFile(envPath: string): Partial<MystEnvironmentVariables> {
  const config: Partial<MystEnvironmentVariables> = {};
  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!key) continue;

    const value = valueParts.join("=").trim();
    const configKey = ENV_MAPPING[key as EnvKey];

    if (configKey) {
      config[configKey] = value;
    }
  }

  return config;
}

export function validateDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function escapeEnvValue(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n")
    .replace(/\$/g, "\\$")}"`;
}

export function generateEnvFile(options: MystEnvironmentVariables): string {
  const lines = [
    `# Public URL used for share links.`,
    `${ENV_MAPPING.MYST_PUBLIC_URL}=${escapeEnvValue(options.publicUrl)}`,
    ``,
    `# Private operator URL for the admin UI. Protect this upstream.`,
    `${ENV_MAPPING.MYST_ADMIN_URL}=${escapeEnvValue(options.adminUrl)}`,
    ``,
    `# Myst's own Postgres database.`,
    `${ENV_MAPPING.DATABASE_URL}=${escapeEnvValue(options.databaseUrl)}`,
    ``,
    `# Existing Forgejo instance and operator-created PAT for the dedicated Forgejo user.`,
    `${ENV_MAPPING.FORGEJO_BASE_URL}=${escapeEnvValue(options.forgejoBaseUrl)}`,
    `${ENV_MAPPING.FORGEJO_BOT_USERNAME}=${escapeEnvValue(options.forgejoBotUsername)}`,
    `${ENV_MAPPING.FORGEJO_PAT}=${escapeEnvValue(options.forgejoPat)}`,
    ``,
    `# Secret used to sign or derive grant tokens.`,
    `${ENV_MAPPING.GRANT_TOKEN_SECRET}=${escapeEnvValue(options.grantTokenSecret)}`,
  ];

  return lines.join("\n");
}