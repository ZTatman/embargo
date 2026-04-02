#!/usr/bin/env node
import * as c from "yoctocolors";
import pkg from "../package.json" with { type: "json" };

import {
  initCommand,
} from "./commands/index.js";

const PADDING = 4;
const INDENT = "  ";
const USAGE = "myst <command> [options/flags] [arguments]";

type CommandName = "init";

interface Option {
  name: CommandName | string | string[];
  desc: string;
}

interface CLIConfig {
  commands: Option[];
  globalFlags: Option[];
}

const config: CLIConfig = {
  commands: [
    { name: "init", desc: "Bootstrap Myst and generate config/env files" },
    { name: "start", desc: "Start Myst grant access control services" },
    { name: "stop", desc: "Stop Myst grant access control services" },
    { name: "status", desc: "List the health of running Myst services" },
  ],
  globalFlags: [
    { name: ["-h", "--help"], desc: "Display help information" },
    { name: ["-v", "--version"], desc: "Display package version number" },
  ],
};

const splitCamelCaseWords = (text: string): string =>
  text.replace(/([a-z])([A-Z])/g, "$1 $2");

const toTitleCase = (text: string): string =>
  text.replace(/\b\w/g, (c) => c.toUpperCase());

function formatSection(
  header: string,
  options: Option[],
  colWidth: number,
): string {
  const rows = options.map((o) => {
    const name = Array.isArray(o.name) ? o.name.join(", ") : o.name;
    return `${INDENT}${name.padEnd(colWidth)}${o.desc}`;
  });
  const title = toTitleCase(splitCamelCaseWords(header));
  return [c.bold(title + ":"), ...rows].join("\n");
}

const allOptions = Object.values(config).flat();
const COL_WIDTH =
  Math.max(
    ...allOptions.map((o) =>
      Array.isArray(o.name) ? o.name.join(", ").length : o.name.length,
    ),
  ) + PADDING;

const HELP_TEXT = `
${c.yellow(pkg.name)}


${INDENT}${USAGE}


${Object.entries(config)
  .map(([header, options]) =>
    formatSection(header, options as Option[], COL_WIDTH),
  )
  .join("\n\n")}
`;

async function main(): Promise<void> {
  const [command, ...options] = process.argv.slice(2);
  const flags = options.filter((o) => o.startsWith("-"));

  if (!command || flags.includes("-h") || flags.includes("--help")) {
    process.stdout.write(`${HELP_TEXT}`);
    process.exitCode = 0;
    return;
  }

  const knownCommands: Record<CommandName, (args: string[]) => Promise<void>> =
    {
      init: initCommand,
    };

  const isKnownCommand = (cmd: string): cmd is CommandName =>
    cmd in knownCommands;

  if (!isKnownCommand(command)) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    await knownCommands[command](options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${c.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
