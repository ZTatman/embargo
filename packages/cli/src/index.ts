#!/usr/bin/env node
import * as c from "yoctocolors";
import pkg from "../package.json" with { type: "json" };

import { initCommand } from "./commands/init.js";
import { getHelpText } from "./help.js";

type CommandName = "init";

type CommandHandler = (args: string[]) => Promise<void>;

const commandHandlers: Record<CommandName, CommandHandler> = {
  init: initCommand,
};

function isKnownCommand(value: string): value is CommandName {
  return value in commandHandlers;
}

async function main(): Promise<void> {
  const [command, ...options] = process.argv.slice(2);
  const flags = options.filter((o) => o.startsWith("-"));

  if (flags.includes("-v") || flags.includes("--version")) {
    process.stdout.write(`${pkg.version}\n`);
    process.exitCode = 0;
    return;
  }

  if (!command || flags.includes("-h") || flags.includes("--help")) {
    process.stdout.write(getHelpText());
    process.exitCode = 0;
    return;
  }

  if (!isKnownCommand(command)) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    await commandHandlers[command](options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${c.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
