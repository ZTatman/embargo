#!/usr/bin/env node

import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";

type CommandName = "init" | "start" | "status" | "stop";

const HELP_TEXT = `Embargo CLI

Usage:
  embargo <command> [options]

Commands:
  init    Generate the local Embargo stack scaffold
  start   Print the docker compose command used to start the stack
  stop    Print the docker compose command used to stop the stack
  status  Validate docker tooling and generated files
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const knownCommands: Record<CommandName, (argv: string[]) => Promise<void>> = {
    init: initCommand,
    start: startCommand,
    status: statusCommand,
    stop: stopCommand
  };

  if (!(command in knownCommands)) {
    process.stderr.write(`Unknown command: ${command}\n\n${HELP_TEXT}\n`);
    process.exitCode = 1;
    return;
  }

  await knownCommands[command as CommandName](args);
}

void main();

