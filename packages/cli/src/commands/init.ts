import fs from "node:fs/promises";
import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

import { generateSecret } from "../utils/crypto.js";
import { generateEnvFile } from "../config.js";

/**
 * Normalizes a URL to use https:// if no protocol is specified.
 * @param value - The URL to normalize.
 * @returns {string} The normalized URL.
 */
function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  const hasProtocol = /^[a-z]+:\/\//i.test(trimmed);
  const isNotHttp = !/^https?:\/\//i.test(trimmed);

  if (hasProtocol && isNotHttp) {
    throw new Error("URLs must use http:// or https://");
  }

  return hasProtocol ? trimmed : `https://${trimmed}`;
}

/**
 * Validates a URL or host, returning the normalized URL or undefined if valid.
 * @param value - The URL or host to validate.
 * @param label - The label to use in error messages.
 * @returns {string | undefined} The normalized URL or undefined if valid.
 */
function validateHttpUrlOrHost(
  value: string | undefined,
  label: string,
): string | undefined {
  if (!value?.trim()) return `${label} is required`;

  try {
    const normalized = normalizeHttpUrl(value);
    const url = new URL(normalized);
    if (!url.hostname) {
      return `${label} must include a domain or hostname`;
    }
  } catch {
    return `${label} must be a valid URL or hostname`;
  }

  return undefined;
}

/**
 * Validates a Postgres URL, returning undefined if valid.
 * @param value - The Postgres URL to validate.
 * @returns {string | undefined} The error message or undefined if valid.
 */
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

/**
 * Writes a private file to disk, throwing an error if the file already exists.
 * @param filePath - The path to the file to write.
 * @param content - The content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function writePrivateFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.writeFile(filePath, content, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
    if (error.code === "EEXIST") {
      throw new Error(
        `Error: the file '${c.underline(path.basename(filePath))}' already exists in directory ${c.underline(path.dirname(filePath))}`,
      );
    }
    throw error; // throw any other errors back if not EEXIST code
  }
}

/**
 * Preflight check for write targets, throwing an error if any target file already exists.
 * @param filePaths - The paths of the files to write.
 * @returns {Promise<void>} A promise that resolves when all targets are checked.
 */
async function preflightWriteTargets(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      await fs.access(filePath);
      throw new Error(
        `Error: the file '${c.underline(path.basename(filePath))}' already exists in directory ${c.underline(path.dirname(filePath))}`,
      );
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

/**
 * Initializes a Myst project by creating the necessary configuration files.
 * @param _args - The command arguments.
 * @returns {Promise<void>} A promise that resolves when the initialization is complete.
 */
export async function initCommand(args?: string[]): Promise<void> {
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
      forgejoBotUsername: () =>
        p.text({
          message:
            "What dedicated Forgejo username should Myst use for API access?",
          placeholder: "myst-bot",
          validate: (v) =>
            v?.trim() ? undefined : "Dedicated Forgejo username is required",
        }),
      forgejoPat: () =>
        p.password({
          message:
            "Paste the Forgejo personal access token for that dedicated Forgejo user",
          mask: "*",
          validate: (v) => (v?.trim() ? undefined : "Forgejo PAT is required"),
        }),
      grantTokenSecret: () =>
        p.password({
          message:
            "Paste a grant token secret, or press enter to generate one automatically",
          mask: "*",
          validate: () => undefined,
        }),
    },
    {
      onCancel: () => {
        p.cancel("\nOperation cancelled.");
        process.exit(0);
      },
    },
  );

  const s = p.spinner();

  try {
    s.start("Generating config files");

    const publicUrl = normalizeHttpUrl(answers.publicUrl);
    const adminUrl = normalizeHttpUrl(answers.adminUrl);
    const forgejoBaseUrl = normalizeHttpUrl(answers.forgejoBaseUrl);
    const grantTokenSecret =
      answers.grantTokenSecret?.trim() || generateSecret();

    const envContent = generateEnvFile({
      adminUrl,
      databaseUrl: answers.databaseUrl,
      forgejoBaseUrl,
      forgejoBotUsername: answers.forgejoBotUsername,
      forgejoPat: answers.forgejoPat,
      grantTokenSecret,
      publicUrl,
    });

    const outDir = process.cwd();
    const envPath = path.join(outDir, ".env");

    await preflightWriteTargets([envPath]);
    await writePrivateFile(envPath, envContent);

    s.stop("Config files generated");
    p.note(c.green(".env"), c.yellow("File written to current directory"));
    p.note(
      [
        `${c.bold("Public viewer URL:")} ${c.cyan(publicUrl)}`,
        `${c.bold("Private admin URL:")} ${c.cyan(adminUrl)}`,
        `${c.bold("Forgejo base URL:")} ${c.cyan(forgejoBaseUrl)}`,
        `${c.bold("Forgejo bot username:")} ${c.green(answers.forgejoBotUsername)}`,
        "",
        `${c.bold("Admin URL reminder:")} protect this upstream with Tailscale, VPN, Cloudflare Access, or reverse-proxy auth.`,
      ].join("\n"),
      c.yellow("Next steps"),
    );
    p.outro(
      c.green(
        "Done. Deploy Myst, then run forgejo bootstrap and doctor commands to verify setup.",
      ),
    );
  } catch (error) {
    s.stop();
    p.cancel(
      error instanceof Error ? error.message : "Failed to initialize Myst",
    );
    process.exitCode = 1;
  }
}
