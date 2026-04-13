import path from "node:path";

import * as c from "yoctocolors";

import {
  ENV_MAPPING,
  MystEnvironmentVariables,
  parseEnvFile,
  SECRET_KEYS,
} from "../../utils/config.js";
import { CommandConfig } from "../../cli-router.js";

export const commandConfig: CommandConfig = {
  description: "Display current configuration",
  handler: async () => {
    const envPath = path.join(process.cwd(), ".env");

    let config: Partial<MystEnvironmentVariables>;

    try {
      config = parseEnvFile(envPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        process.stderr.write(
          `${c.red("Error:")} .env file not found in ${process.cwd()}\n`,
        );
        process.exitCode = 1;
        return;
      }
      throw error;
    }

    process.stdout.write(c.bold("Myst Configuration\n"));
    process.stdout.write(`${c.dim("─".repeat(40))}\n`);

    for (const [envKey, configKey] of Object.entries(ENV_MAPPING)) {
      const value = config[configKey];
      const displayValue = SECRET_KEYS.includes(
        configKey as (typeof SECRET_KEYS)[number],
      )
        ? c.dim("****")
        : value || c.dim("not set");
      process.stdout.write(`${c.bold(envKey + ":")} ${displayValue}\n`);
    }

    process.exitCode = 0;
  },
};
