import { access } from "node:fs/promises";
import path from "node:path";

import { assertDockerPrerequisites } from "../utils/docker.js";
import { getFlagValue } from "../utils/flags.js";

const REQUIRED_FILES = [
  "docker-compose.yml",
  ".env",
  "forgejo/app.ini",
  "examples/Caddyfile",
  "examples/nginx.conf"
] as const;

export async function statusCommand(argv: string[]): Promise<void> {
  assertDockerPrerequisites();

  const outputDir = path.resolve(process.cwd(), getFlagValue(argv, "--dir") ?? "embargo");
  const results = await Promise.all(
    REQUIRED_FILES.map(async (file) => {
      const filePath = path.join(outputDir, file);

      try {
        await access(filePath);
        return `OK  ${file}`;
      } catch {
        return `MISS ${file}`;
      }
    })
  );

  process.stdout.write([`Scaffold directory: ${outputDir}`, ...results].join("\n") + "\n");
}

