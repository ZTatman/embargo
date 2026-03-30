import path from "node:path";

import { assertDockerPrerequisites, getComposeCommand } from "../utils/docker.js";
import { getFlagValue } from "../utils/flags.js";

export async function startCommand(argv: string[]): Promise<void> {
  assertDockerPrerequisites();

  const outputDir = path.resolve(process.cwd(), getFlagValue(argv, "--dir") ?? "embargo");
  process.stdout.write(`${getComposeCommand(outputDir)} up -d\n`);
}

