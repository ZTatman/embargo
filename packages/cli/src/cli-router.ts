import { parseArgs } from "node:util";

import * as c from "yoctocolors";

type Handler = (opts: Record<string, unknown>) => Promise<void>;

interface OptionSpec {
  type: "string" | "boolean";
  short?: string;
  default?: string | boolean | string[] | boolean[];
  description?: string;
}

type OptionsSpec = Record<string, OptionSpec>;

export interface CommandConfig {
  description?: string;
  options?: OptionsSpec;
  subcommands?: Record<string, CommandConfig>;
  handler?: Handler;
}

export type CommandRegistry = Record<string, CommandConfig>;

function showHelp(registry: CommandRegistry, description: string): void {
  const PADDING = 4;
  const INDENT = "  ";

  type HelpRow = { name: string; desc?: string };

  const rows: HelpRow[] = [];

  function addCommands(cmds: CommandRegistry, prefix = "") {
    for (const [name, def] of Object.entries(cmds)) {
      const fullName = prefix ? `${prefix} ${name}` : name;
      if (def.subcommands) {
        rows.push({ name: fullName });
        addCommands(def.subcommands, fullName);
      } else if (def.description) {
        rows.push({ name: fullName, desc: def.description });
      }
    }
  }

  addCommands(registry);

  const globalFlagRows: HelpRow[] = [
    { name: "-h, --help", desc: "Display help" },
    { name: "-v, --version", desc: "Display version" },
  ];

  const allRows = [...rows, ...globalFlagRows];
  const colWidth = Math.max(...allRows.map((r) => r.name.length)) + PADDING;

  const lines: string[] = [];
  lines.push(c.yellow("myst"));
  lines.push("");
  lines.push(`${INDENT}${description}`);
  lines.push("");
  lines.push(c.bold("Usage:"));
  lines.push(`${INDENT}myst <command> [options]`);
  lines.push("");

  lines.push(c.bold("Commands:"));
  for (const row of rows) {
    if (row.desc) {
      lines.push(`${INDENT}${row.name.padEnd(colWidth)}${c.dim(row.desc)}`);
    } else {
      lines.push(`${INDENT}${c.bold(row.name)}`);
    }
  }

  lines.push("");
  lines.push(c.bold("Global options:"));
  for (const row of globalFlagRows) {
    const desc = row.desc ?? "";
    lines.push(`${INDENT}${row.name.padEnd(colWidth)}${c.dim(desc)}`);
  }

  process.stdout.write(lines.join("\n") + "\n");
}

function showCommandHelp(
  command: string,
  cmdConf: CommandConfig,
  subcommand?: string,
): void {
  const PADDING = 4;
  const INDENT = "  ";

  type HelpRow = { name: string; desc?: string };

  let targetConf: CommandConfig = cmdConf;

  if (subcommand && cmdConf.subcommands) {
    targetConf = cmdConf.subcommands[subcommand] ?? cmdConf;
  }

  const lines: string[] = [];

  const fullName = subcommand ? `${command} ${subcommand}` : command;
  lines.push(c.yellow("myst " + fullName));
  lines.push("");

  if (targetConf.description) {
    lines.push(`${INDENT}${targetConf.description}`);
    lines.push("");
  }

  const usageCmd = subcommand ? `${command} ${subcommand}` : command;
  lines.push(c.bold("Usage:"));
  lines.push(`${INDENT}myst ${usageCmd} [options]`);
  lines.push("");

  if (targetConf.options && Object.keys(targetConf.options).length > 0) {
    const optionRows: HelpRow[] = [];

    for (const [optName, optSpec] of Object.entries(targetConf.options)) {
      const short = optSpec.short ? `, -${optSpec.short}` : "";
      const typeHint = optSpec.type === "string" ? " <value>" : "";
      const desc = optSpec.description ?? "";
      optionRows.push({
        name: `--${optName}${short}${typeHint}`,
        desc,
      });
    }

    const colWidth =
      Math.max(...optionRows.map((r) => r.name.length)) + PADDING;

    lines.push(c.bold("Options:"));
    for (const row of optionRows) {
      if (row.desc) {
        lines.push(`${INDENT}${row.name.padEnd(colWidth)}${c.dim(row.desc)}`);
      } else {
        lines.push(`${INDENT}${row.name}`);
      }
    }
    lines.push("");
  }

  lines.push(c.bold("Global options:"));
  lines.push(`${INDENT}-h, --help       Display help`);
  lines.push(`${INDENT}-v, --version    Display version`);

  process.stdout.write(lines.join("\n") + "\n");
}

export async function runCli(
  argv: string[],
  registry: CommandRegistry,
): Promise<void> {
  // Load package info once
  const pkg = await import("../package.json", { with: { type: "json" } });
  const description = pkg.default.description;
  const version = pkg.default.version;

  // Check for help/version flags
  const isHelpFlag = (arg: string) => arg === "--help" || arg === "-h";
  const isVersionFlag = (arg: string) => arg === "--version" || arg === "-v";

  // Check for version flag (early exit)
  if (argv.length > 0 && argv.every(isVersionFlag)) {
    process.stdout.write(version + "\n");
    return;
  }

  // If no args or only help flags, show global help
  if (argv.length === 0 || argv.every(isHelpFlag)) {
    showHelp(registry, description);
    return;
  }

  // Extract command and subcommand directly from argv
  const command = argv[0] ?? "";
  const subcommand = argv[1] ?? "";
  const remainingArgs = argv.slice(2);

  // If user types myst -h or --help with a command
  const wantsCommandHelp =
    isHelpFlag(subcommand) || remainingArgs.some(isHelpFlag);

  const cmdConf = registry[command];

  // Check if the command exists
  if (!cmdConf) {
    process.stderr.write(`${c.red("Error:")} Unknown command: ${command}\n`);
    process.exitCode = 1;
    return;
  }

  // If help is requested for a specific command, show command-specific help
  if (wantsCommandHelp) {
    const isHelpFlag = (arg: string) => arg === "--help" || arg === "-h";
    const actualSubcommand = isHelpFlag(subcommand) ? undefined : subcommand;
    showCommandHelp(command, cmdConf, actualSubcommand);
    return;
  }

  let targetCmdConf: CommandConfig | undefined;

  // Check if subcommand was passed and if it's a valid subcommand (not an option flag)
  const subcommands = cmdConf.subcommands;
  const isSubcommandAnOption = subcommand && subcommand.startsWith("-");

  if (isSubcommandAnOption) {
    // Subcommand looks like an option (e.g., --diagnostic), treat as option for parent
    targetCmdConf = cmdConf.handler ? cmdConf : undefined;
  } else if (subcommand && subcommands && subcommand in subcommands) {
    targetCmdConf = subcommands[subcommand];
  } else if (!subcommand && cmdConf.handler) {
    // No subcommand passed, use the parent command handler directly
    targetCmdConf = cmdConf;
  }

  // Check if the target subcommand handler exists
  if (!targetCmdConf?.handler) {
    if (subcommands && Object.keys(subcommands).length > 0) {
      process.stderr.write(
        `${c.red("Error:")} Missing subcommand for '${command}'. Available: ${Object.keys(subcommands).join(", ")}\n`,
      );
    } else {
      // No subcommands available, treat as unknown subcommand
      process.stderr.write(
        `${c.red("Error:")} Unknown subcommand: ${subcommand}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  // Build args for parseArgs - if subcommand is an option, include it
  const argsForOptions = isSubcommandAnOption
    ? [subcommand, ...remainingArgs]
    : remainingArgs;

  // Parse target command options
  const { values: cmdOpts } = parseArgs({
    args: argsForOptions,
    options: targetCmdConf.options || {},
    allowPositionals: true,
  });

  try {
    // Execute the target command handler
    await targetCmdConf.handler(cmdOpts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${c.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}
