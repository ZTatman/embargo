import fs from "node:fs/promises";
import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

import { generateEnvFile, SECRET_ENV_KEYS } from "../../utils/config.js";
import { validateForgejoBaseUrl } from "../../utils/forgejo-checks.js";
import { CommandConfig } from "../../cli-router.js";

async function init(opts: { output?: string }) {
  p.intro(c.bold("firebreak config init"));
  p.note(
    [
      `${c.bold("Run this in the directory where you plan to deploy Firebreak.")}`,
      "",
      c.bold("Forgejo docs:"),
      "",
      `- API usage: ${c.cyan("https://forgejo.org/docs/latest/user/api-usage/")}`,
      `- Token scopes: ${c.cyan("https://forgejo.org/docs/latest/user/token-scope/")}`,
      `- Repo permissions: ${c.cyan("https://forgejo.org/docs/latest/user/repo-permissions/")}`,
      `- Admin CLI: ${c.cyan("https://forgejo.org/docs/latest/admin/command-line/")}`,
      "",
      `1. Generate a PAT in Forgejo ${c.bold("Settings -> Applications")}.`,
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
        const maskedEnvContent = envContent
          .split("\n")
          .map((line) => {
            if (!line.includes("=")) return line;
            const [key] = line.split("=");
            return SECRET_ENV_KEYS.includes(
              key as (typeof SECRET_ENV_KEYS)[number],
            )
              ? `${key}=****`
              : line;
          })
          .join("\n");
        p.note(c.dim(maskedEnvContent), c.yellow("Current .env"));
        continue;
      }

      if (choice === "overwrite") {
        break;
      }
    }
  }

  const answers = await p.group(
    {
      forgejoBaseUrl: () =>
        p.text({
          message:
            "Forgejo API URL (how Firebreak reaches Forgejo, not your browser URL)?",
          placeholder: "http://forgejo:3000",
          validate: (v) => validateForgejoBaseUrl(v),
        }),
      forgejoPat: () =>
        p.password({
          message: "Paste the Forgejo personal access token",
          mask: "*",
          validate: (v) => (v?.trim() ? undefined : "Forgejo PAT is required"),
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

    const forgejoBaseUrl = answers.forgejoBaseUrl.trim();

    const envContent = generateEnvFile({
      forgejoBaseUrl,
      forgejoPat: answers.forgejoPat,
    });

    if (envExists) {
      const tempPath = envPath + ".tmp";
      await fs.unlink(tempPath).catch(() => {});
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
        `${c.bold("Forgejo API URL:")} ${c.cyan(forgejoBaseUrl)}`,
        "",
        `Firebreak will use this URL to call Forgejo's API.`,
        `- Docker (same Compose network): http://forgejo:3000`,
        `- Bare metal / non-container:    http://localhost:3000`,
        `- Cross-host deployment:         https://git.example.com`,
      ].join("\n"),
    );
    p.log.success(
      "Done. Verify Firebreak's connection using 'firebreak config verify'.\nOnce verified, deploy!",
    );
  } catch (error) {
    s.stop();
    p.cancel(
      error instanceof Error ? error.message : "Failed to initialize Firebreak",
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
