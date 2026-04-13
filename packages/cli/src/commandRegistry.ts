import * as configInit from "./commands/config/init.js";
import * as configView from "./commands/config/view.js";
import * as verify from "./commands/verify.js";

export const commandRegistry = {
  config: {
    description: "Configuration commands",
    subcommands: {
      init: configInit.commandConfig,
      view: configView.commandConfig,
      verify: verify.commandConfig,
    },
  },
};