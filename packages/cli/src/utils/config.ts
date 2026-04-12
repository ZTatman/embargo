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

export function parseEnvFile(
  envPath: string,
): Partial<MystEnvironmentVariables> {
  const config: Partial<MystEnvironmentVariables> = {};
  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!key) continue;

    const value = valueParts.join("=").trim();
    const configKey = ENV_MAPPING[key as keyof typeof ENV_MAPPING];

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
    return DATABASE_PROTOCOLS.includes(
      parsed.protocol as "postgres:" | "postgresql:",
    );
  } catch {
    return false;
  }
}

export function generateEnvFile(options: MystEnvironmentVariables): string {
  const lines = [
    `# Public URL used for share links.`,
    `MYST_PUBLIC_URL=${options.publicUrl}`,
    ``,
    `# Private operator URL for the admin UI. Protect this upstream.`,
    `MYST_ADMIN_URL=${options.adminUrl}`,
    ``,
    `# Myst's own Postgres database.`,
    `DATABASE_URL=${options.databaseUrl}`,
    ``,
    `# Existing Forgejo instance and operator-created PAT for the dedicated Forgejo user.`,
    `FORGEJO_BASE_URL=${options.forgejoBaseUrl}`,
    `FORGEJO_BOT_USERNAME=${options.forgejoBotUsername}`,
    `FORGEJO_PAT=${options.forgejoPat}`,
    ``,
    `# Secret used to sign or derive grant tokens.`,
    `GRANT_TOKEN_SECRET=${options.grantTokenSecret}`,
  ];

  return lines.join("\n");
}
