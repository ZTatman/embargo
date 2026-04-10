#!/usr/bin/env node
import { parseArgs } from "node:util";

import * as c from "yoctocolors";
import pkg from "../package.json" with { type: "json" };

import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { verifyCommand } from "./commands/verify.js";
import { doctorCommand } from "./commands/doctor.js";
import { getHelpText } from "./help.js";

type CommandName = "init" | "config" | "verify" | "doctor";

type CommandHandler = (args?: string[]) => Promise<void>;

const commandHandlers: Record<CommandName, CommandHandler> = {
  init: initCommand,
  config: configCommand,
  verify: verifyCommand,
  doctor: doctorCommand,
};

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      version: {
        type: "boolean",
        short: "v",
      },
      help: {
        type: "boolean",
        short: "h",
      },
      output: {
        type: "string",
        short: "o",
      },
    },
    allowPositionals: true,
  });

  const command = positionals[0];

  if (!command) {
    process.stdout.write(getHelpText());
    process.exitCode = 0;
    return;
  }

  const isKnownCommand = (cmd: string): cmd is CommandName =>
    cmd in commandHandlers;

  if (!isKnownCommand(command)) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 1;
    return;
  }

  if (values.help) {
    process.stdout.write(getHelpText());
    process.exitCode = 0;
    return;
  }

  if (values.version) {
    process.stdout.write(`${pkg.version}`);
    process.exitCode = 0;
    return;
  }

  try {
    await commandHandlers[command]();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${c.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
