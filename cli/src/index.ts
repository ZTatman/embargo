#!/usr/bin/env node
import { runCli } from "./cli-router.js";
import { commandRegistry } from "./commandRegistry.js";

await runCli(process.argv.slice(2), commandRegistry);
