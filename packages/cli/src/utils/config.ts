import fs from "node:fs";

export interface MystEnvironmentVariables {
  forgejoBaseUrl: string;
  forgejoPat: string;
}

export const ENV_MAPPING = {
  FORGEJO_BASE_URL: "forgejoBaseUrl",
  FORGEJO_PAT: "forgejoPat",
} as const;

export const REQUIRED_KEYS = [
  "forgejoBaseUrl",
  "forgejoPat",
] as const;

export const SECRET_KEYS = ["forgejoPat"] as const;

export const SECRET_ENV_KEYS = ["FORGEJO_PAT"] as const;

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

export function generateEnvFile(options: MystEnvironmentVariables): string {
  const lines = [
    `# Forgejo instance (used for API access).`,
    `FORGEJO_BASE_URL=${options.forgejoBaseUrl}`,
    `FORGEJO_PAT=${options.forgejoPat}`,
  ];

  return lines.join("\n");
}
