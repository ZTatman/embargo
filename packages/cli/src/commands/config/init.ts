import fs from "node:fs/promises";
import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

import { generateSecret } from "../../utils/crypto.js";
import { generateEnvFile } from "../../utils/config.js";
import { CommandConfig } from "../../cli-router.js";

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  const hasProtocol = /^[a-z]+:\/\//i.test(trimmed);
  const isNotHttp = !/^https?:\/\//i.test(trimmed);

  if (hasProtocol && isNotHttp) {
    throw new Error("URLs must use http:// or https://");
  }

  return hasProtocol ? trimmed : `https://${trimmed}`;
}

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

async function init(opts: { output?: string }) {
  p.intro(c.bold("myst config init"));
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

  const envPath = opts.output || path.join(process.cwd(), ".env");

  // Check if .env file already exists
  let envExists = false;
  try {
    await fs.stat(envPath);
    envExists = true;
  } catch {
    // .env file does not exist
  }

  // Handle existing .env file
  if (envExists) {
    while (true) {
      const choice = await p.select({
        message: c.red(
          `The file .env already exists at ${envPath}. What would you like to do?`,
        ),
        options: [
          { value: "view", label: "View .env content" },
          { value: "overwrite", label: "Overwrite .env" },
          { value: "cancel", label: "Cancel" },
        ],
      });

      if (p.isCancel(choice) || choice === "cancel") {
        p.cancel("\nOperation cancelled.");
        process.exitCode = 0;
        return;
      }

      if (choice === "view") {
        const envContent = await fs.readFile(envPath, { encoding: "utf-8" });
        p.note(c.dim(envContent), c.yellow("Current .env"));
        continue;
      }

      if (choice === "overwrite") {
        break;
      }
    }
  }

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
        process.exitCode = 0;
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

    if (envExists) {
      const tempPath = envPath + ".tmp";
      await fs.writeFile(tempPath, envContent, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });

      await fs.unlink(envPath).catch(() => {});
      await fs.rename(tempPath, envPath);
    } else {
      await fs.writeFile(envPath, envContent, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
    }

    s.stop(c.yellow(`.env created at ${envPath}`));
    p.note(
      [
        `${c.bold("Public viewer URL:")} ${c.cyan(publicUrl)}`,
        `${c.bold("Admin URL:")} ${c.cyan(adminUrl)}`,
        `${c.bold("Forgejo base URL:")} ${c.cyan(forgejoBaseUrl)}`,
        `${c.bold("Myst bot username:")} ${c.cyan(answers.forgejoBotUsername)}`,
        "",
        `${c.bold("Admin URL reminder:")} protect this upstream with Tailscale, VPN, Cloudflare Access, or reverse-proxy auth.`,
      ].join("\n"),
    );
    p.log.success(
      "Done. Verify myst's connection using the 'verify' command.\nOnce verified, deploy!",
    );
  } catch (error) {
    s.stop();
    p.cancel(
      error instanceof Error ? error.message : "Failed to initialize Myst",
    );
    process.exitCode = 1;
  }
}

export const commandConfig: CommandConfig = {
  description: "Generate .env file",
  options: {
    output: { type: "string", short: "o" },
  },
  handler: init,
};
