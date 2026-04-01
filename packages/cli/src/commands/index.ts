import path from "node:path";
import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import * as c from "yoctocolors";
import { generateEnvFile } from "../generators/env.js";
import { generateSecret } from "../utils/crypto.js";

interface MystConfig {
  adminUrl: string;
  databaseUrl: string;
  forgejoBaseUrl: string;
  forgejoServiceAccountUsername: string;
  publicUrl: string;
}

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function validateHttpUrlOrHost(
  value: string | undefined,
  label: string,
): string | undefined {
  if (!value?.trim()) {
    return `${label} is required`;
  }

  try {
    const url = new URL(normalizeHttpUrl(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return `${label} must start with http:// or https://`;
    }

    if (!url.hostname) {
      return `${label} must include a domain or hostname`;
    }
  } catch {
    return `${label} must be a valid URL or hostname`;
  }

  return undefined;
}

function validatePostgresUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return "Database URL is required";
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return "Database URL must start with postgres:// or postgresql://";
    }
  } catch {
    return "Database URL must be a valid Postgres connection string";
  }

  return undefined;
}

function generateConfigFile(config: MystConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export async function initCommand(_args: string[]): Promise<void> {
  p.intro(c.bold("myst init"));

  p.note(
    [
      `${c.bold("Run this in the directory where you plan to deploy Myst.")}`,
      "",
      c.bold("Forgejo docs:"),
      "",
      `- API usage: ${c.cyan("https://forgejo.org/docs/latest/user/api-usage/")}`,
      `- Token scopes: ${c.cyan("https://forgejo.org/docs/latest/user/token-scope/")}`,
      `- Repo permissions: ${c.cyan("https://forgejo.org/docs/latest/user/repo-permissions/")}`,
      `- Admin CLI: ${c.cyan("https://forgejo.org/docs/latest/admin/command-line/")}`,
      "",
      `1. Create a dedicated Forgejo user such as ${c.bold("myst-bot")} and generate its PAT in Forgejo ${c.bold("Settings -> Applications")}.`,
      `2. Generate a PAT with the appropriate scopes for your Forgejo setup.`,
      "",
      `Recommended PAT scopes:\n - ${c.bold("read:user")}\n - ${c.bold("read:repository")}\n - ${c.bold("read:organization")} (optional)`,
    ].join("\n"),
    c.yellow("Before you start:"),
  );

  const answers = await p.group(
    {
      publicUrl: () =>
        p.text({
          message: "Domain name or URL for the public viewer",
          placeholder: "share.example.com",
          validate: (v) => validateHttpUrlOrHost(v, "Public viewer URL"),
        }),
      adminUrl: () =>
        p.text({
          message: "Domain name or URL for the Myst admin UI",
          placeholder: "admin.example.com",
          validate: (v) => validateHttpUrlOrHost(v, "Private admin URL"),
        }),
      forgejoBaseUrl: () =>
        p.text({
          message: "Domain name or URL for your existing Forgejo instance?",
          placeholder: "git.example.com",
          validate: (v) => validateHttpUrlOrHost(v, "Forgejo base URL"),
        }),
      databaseUrl: () =>
        p.text({
          message: "What Postgres connection string should Myst use?",
          placeholder: "postgresql://myst:password@db.example.com:5432/myst",
          validate: validatePostgresUrl,
        }),
      forgejoServiceAccountUsername: () =>
        p.text({
          message:
            "What Forgejo service account username should Myst use for API access?",
          placeholder: "myst-bot",
          validate: (v) =>
            v?.trim()
              ? undefined
              : "Forgejo service account username is required",
        }),
      forgejoPat: () =>
        p.password({
          message:
            "Paste the Forgejo personal access token for that service account",
          validate: (v) => (v?.trim() ? undefined : "Forgejo PAT is required"),
        }),
      grantTokenSecret: () =>
        p.password({
          message:
            "Paste a grant token secret, or press enter to generate one automatically",
          validate: () => undefined,
        }),
    },
    {
      onCancel: () => {
        process.stderr.write("\nOperation cancelled.");
        process.exit(0);
      },
    },
  );

  const s = p.spinner();
  s.start("Generating config files");

  const publicUrl = normalizeHttpUrl(answers.publicUrl);
  const adminUrl = normalizeHttpUrl(answers.adminUrl);
  const forgejoBaseUrl = normalizeHttpUrl(answers.forgejoBaseUrl);
  const grantTokenSecret = answers.grantTokenSecret?.trim() || generateSecret();
  const envContent = generateEnvFile({
    adminUrl,
    databaseUrl: answers.databaseUrl,
    forgejoBaseUrl,
    forgejoPat: answers.forgejoPat,
    forgejoServiceAccountUsername: answers.forgejoServiceAccountUsername,
    grantTokenSecret,
    publicUrl,
  });
  const configContent = generateConfigFile({
    adminUrl,
    databaseUrl: answers.databaseUrl,
    forgejoBaseUrl,
    forgejoServiceAccountUsername: answers.forgejoServiceAccountUsername,
    publicUrl,
  });

  const outDir = process.cwd();
  await Promise.all([
    fs.writeFile(path.join(outDir, ".env"), envContent, "utf8"),
    fs.writeFile(
      path.join(outDir, "myst.config.json"),
      configContent,
      "utf8",
    ),
  ]);

  s.stop("Config files generated");

  p.note(
    [c.green(".env"), c.green("myst.config.json")].join("\n"),
    c.yellow("Files written to current directory"),
  );

  p.note(
    [
      `${c.bold("Public viewer URL:")} ${c.cyan(publicUrl)}`,
      `${c.bold("Private admin URL:")} ${c.cyan(adminUrl)}`,
      `${c.bold("Forgejo base URL:")} ${c.cyan(forgejoBaseUrl)}`,
      `${c.bold("Forgejo service account:")} ${c.green(answers.forgejoServiceAccountUsername)}`,
      `${c.bold("Tip:")} entering a bare hostname defaults to ${c.bold("https://")}.`,
      `${c.bold("Admin URL reminder:")} protect this upstream with Tailscale, VPN, Cloudflare Access, or reverse-proxy auth.`,
      `${c.bold("PAT setup docs:")} ${c.cyan("https://forgejo.org/docs/latest/user/api-usage/")}`,
      `${c.bold("PAT scope docs:")} ${c.cyan("https://forgejo.org/docs/latest/user/token-scope/")}`,
      `${c.bold("Next commands:")} ${c.green("myst forgejo bootstrap")} then ${c.green("myst doctor")}`,
    ].join("\n"),
    c.yellow("Next steps"),
  );

  p.outro(
    c.green("Done. Deploy Myst, then run forgejo bootstrap and doctor."),
  );
}
export async function startCommand(...args: any[]): Promise<void> {}
export async function stopCommand(...args: any[]): Promise<void> {}
export async function statusCommand(...args: any[]): Promise<void> {}
