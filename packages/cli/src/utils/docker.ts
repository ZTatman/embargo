import { spawnSync } from "node:child_process";

function assertCommand(command: string, args: string[] = []): void {
  const result = spawnSync(command, args, { stdio: "ignore" });

  if (result.status !== 0) {
    throw new Error(`Required command not available: ${[command, ...args].join(" ")}`);
  }
}

export function assertDockerPrerequisites(): void {
  assertCommand("docker", ["--version"]);
  assertCommand("docker", ["compose", "version"]);
}

export function getComposeCommand(outputDir: string): string {
  return `docker compose --project-directory ${outputDir}`;
}

