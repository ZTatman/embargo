import * as c from "yoctocolors";
import pkg from "../package.json" with { type: "json" };

const PADDING = 4;
const INDENT = "  ";

type HelpRow = {
  name: string;
  desc?: string;
};

const commandRows: HelpRow[] = [
  { name: "init", desc: "Generate config files with the proper env variables" },
];

const globalFlagRows: HelpRow[] = [
  { name: "-h, --help", desc: "Display help information" },
  { name: "-v, --version", desc: "Display package version number" },
];

function formatSection(
  header: string,
  rows: HelpRow[],
  colWidth: number,
): string {
  return [
    c.bold(`${header}:`),
    ...rows.map((row) =>
      row.desc
        ? `${INDENT}${row.name.padEnd(colWidth)}${row.desc}`
        : `${INDENT}${row.name}`,
    ),
  ].join("\n");
}

/**
 * Returns the help text for the CLI.
 * @returns The help text.
 */
export function getHelpText(): string {
  const allRows = [...commandRows, ...globalFlagRows];
  const colWidth = Math.max(...allRows.map((row) => row.name.length)) + PADDING;

  return [
    c.yellow("myst"),
    "",
    `${INDENT}${pkg.description}`,
    "",
    formatSection(
      "Usage",
      [
        {
          name: "myst <command> [options/flags] [arguments]",
        },
      ],
      colWidth,
    ),
    "",
    formatSection("Commands", commandRows, colWidth),
    "",
    formatSection("Global flags", globalFlagRows, colWidth),
    "",
  ].join("\n");
}
