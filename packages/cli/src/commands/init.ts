import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  generateAppIni,
  generateDockerCompose,
  generateEnvFile,
  generateExampleCaddyfile,
  generateExampleNginxConf
} from "../generators/index.js";
import { generateSecret } from "../utils/crypto.js";
import { assertDockerPrerequisites } from "../utils/docker.js";
import { getFlagValue } from "../utils/flags.js";

interface InitOptions {
  domain: string;
  forgejoAdminPassword: string;
  forgejoAdminUser: string;
  outputDir: string;
  visibilityMode: "allowlist" | "team";
}

function parseInitOptions(argv: string[]): InitOptions {
  return {
    domain: getFlagValue(argv, "--domain") ?? "localhost",
    forgejoAdminPassword: getFlagValue(argv, "--forgejo-admin-password") ?? "change-me",
    forgejoAdminUser: getFlagValue(argv, "--forgejo-admin-user") ?? "admin",
    outputDir: getFlagValue(argv, "--dir") ?? "embargo",
    visibilityMode: (getFlagValue(argv, "--visibility-mode") as InitOptions["visibilityMode"] | undefined) ?? "team"
  };
}

export async function initCommand(argv: string[]): Promise<void> {
  const options = parseInitOptions(argv);

  if (options.visibilityMode !== "team" && options.visibilityMode !== "allowlist") {
    throw new Error(`Unsupported visibility mode: ${options.visibilityMode}`);
  }

  assertDockerPrerequisites();

  const outputRoot = path.resolve(process.cwd(), options.outputDir);
  const forgejoDir = path.join(outputRoot, "forgejo");
  const examplesDir = path.join(outputRoot, "examples");

  await mkdir(forgejoDir, { recursive: true });
  await mkdir(examplesDir, { recursive: true });

  const generatedSecrets = {
    dbPassword: generateSecret(),
    embargoAdminPassword: generateSecret(),
    forgejoServicePassword: generateSecret(),
    jwtSecret: generateSecret()
  };

  await Promise.all([
    writeFile(
      path.join(outputRoot, "docker-compose.yml"),
      generateDockerCompose({ domain: options.domain }),
      "utf8"
    ),
    writeFile(
      path.join(outputRoot, ".env"),
      generateEnvFile({
        domain: options.domain,
        forgejoAdminPassword: options.forgejoAdminPassword,
        forgejoAdminUser: options.forgejoAdminUser,
        visibilityMode: options.visibilityMode,
        ...generatedSecrets
      }),
      "utf8"
    ),
    writeFile(path.join(forgejoDir, "app.ini"), generateAppIni(), "utf8"),
    writeFile(path.join(examplesDir, "Caddyfile"), generateExampleCaddyfile(options.domain), "utf8"),
    writeFile(path.join(examplesDir, "nginx.conf"), generateExampleNginxConf(options.domain), "utf8")
  ]);

  process.stdout.write(
    [
      `Generated Embargo scaffold in ${outputRoot}`,
      `Visibility mode: ${options.visibilityMode}`,
      "Generated files:",
      "- docker-compose.yml",
      "- .env",
      "- forgejo/app.ini",
      "- examples/Caddyfile",
      "- examples/nginx.conf"
    ].join("\n") + "\n"
  );
}

