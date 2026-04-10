import fs from "node:fs";
import path from "node:path";

import * as c from "yoctocolors";
import * as p from "@clack/prompts";

interface MystConfig {
  forgejoBaseUrl?: string;
  forgejoBotUsername?: string;
  forgejoPat?: string;
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
      case "FORGEJO_BASE_URL":
        config.forgejoBaseUrl = value;
        break;
      case "FORGEJO_BOT_USERNAME":
        config.forgejoBotUsername = value;
        break;
      case "FORGEJO_PAT":
        config.forgejoPat = value;
        break;
    }
  }

  return config;
}

type CheckResult = {
  name: string;
  success: boolean;
  message?: string;
};

async function checkForgejoReachability(baseUrl: string): Promise<CheckResult> {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (response.ok || response.status === 200) {
      return { name: "Forgejo reachability", success: true };
    }
    return {
      name: "Forgejo reachability",
      success: false,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Forgejo reachability",
      success: false,
      message,
    };
  }
}

async function checkForgejoApi(
  baseUrl: string,
  pat: string,
): Promise<CheckResult> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
      },
    });

    if (response.status === 401) {
      return {
        name: "Forgejo API token",
        success: false,
        message: "Invalid or expired token",
      };
    }

    if (!response.ok) {
      return {
        name: "Forgejo API token",
        success: false,
        message: `HTTP ${response.status}`,
      };
    }

    const user = (await response.json()) as { login: string };
    return {
      name: "Forgejo API token",
      success: true,
      message: `Authenticated as ${c.green(user.login)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Forgejo API token",
      success: false,
      message,
    };
  }
}

async function checkRepoAccess(
  baseUrl: string,
  pat: string,
  username: string,
): Promise<CheckResult> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/users/${username}/repos?limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${pat}`,
        },
      },
    );

    if (!response.ok) {
      return {
        name: "Repository access",
        success: false,
        message: `HTTP ${response.status}`,
      };
    }

    const repos = (await response.json()) as Array<{ name: string }>;
    if (repos.length > 0) {
      const firstRepo = repos[0]!;
      return {
        name: "Repository access",
        success: true,
        message: `Can access repos (sample: ${c.green(firstRepo.name)})`,
      };
    }

    return {
      name: "Repository access",
      success: true,
      message: "Token valid but no repos found",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Repository access",
      success: false,
      message,
    };
  }
}

export async function verifyCommand(): Promise<void> {
  p.intro(c.bold("myst verify"));

  const envPath = path.join(process.cwd(), ".env");

  let config: MystConfig;

  try {
    config = parseEnvFile(envPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      p.cancel(
        `${c.red("Error:")} .env file not found in ${process.cwd()}`,
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const missing: string[] = [];

  if (!config.forgejoBaseUrl) {
    missing.push("FORGEJO_BASE_URL");
  }
  if (!config.forgejoPat) {
    missing.push("FORGEJO_PAT");
  }
  if (!config.forgejoBotUsername) {
    missing.push("FORGEJO_BOT_USERNAME");
  }

  if (missing.length > 0) {
    p.cancel(
      `${c.red("Error:")} Missing required config: ${missing.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const s = p.spinner();

  try {
    s.start("Verifying Forgejo configuration");

    const reachability = await checkForgejoReachability(config.forgejoBaseUrl!);

    if (!reachability.success) {
      s.stop(reachability.message);
      p.cancel(`${c.red("✗")} ${reachability.name}: ${reachability.message}`);
      process.exitCode = 1;
      return;
    }

    const apiToken = await checkForgejoApi(
      config.forgejoBaseUrl!,
      config.forgejoPat!,
    );

    if (!apiToken.success) {
      s.stop(apiToken.message);
      p.cancel(`${c.red("✗")} ${apiToken.name}: ${apiToken.message}`);
      process.exitCode = 1;
      return;
    }

    const repoAccess = await checkRepoAccess(
      config.forgejoBaseUrl!,
      config.forgejoPat!,
      config.forgejoBotUsername!,
    );

    s.stop("Verification complete");

    p.note(
      [
        `${c.green("✓")} ${reachability.name}`,
        `${c.green("✓")} ${apiToken.name}: ${apiToken.message}`,
        `${c.green(repoAccess.success ? "✓" : "✗")} ${repoAccess.name}: ${repoAccess.message}`,
      ].join("\n"),
      c.yellow("Results"),
    );

    if (!repoAccess.success) {
      process.exitCode = 1;
      return;
    }

    p.outro(c.green("Forgejo verification passed"));
  } catch (error) {
    s.stop();
    const message = error instanceof Error ? error.message : "Unknown error";
    p.cancel(`${c.red("Error:")} ${message}`);
    process.exitCode = 1;
  }
}
