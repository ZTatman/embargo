import path from "node:path";
import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import * as c from "yoctocolors";
import { generateEnvFile } from "../generators/env.js";
import { generateDockerCompose } from "../generators/docker-compose.js";
import { generateSecret, generatePassword } from "../utils/crypto.js";

export async function initCommand(_args: string[]): Promise<void> {
  p.intro(c.bold("embargo init"));

  const answers = await p.group(
    {
      domain: () =>
        p.text({
          message: "What domain will Embargo run on?",
          placeholder: "embargo.example.com",
          validate: (v) => (v.trim() ? undefined : "Domain is required"),
        }),
      forgejoAdminUser: () =>
        p.text({
          message: "Forgejo admin username?",
          placeholder: "admin",
          validate: (v) => (v.trim() ? undefined : "Username is required"),
        }),
    },
    {
      onCancel: () => {
        process.stderr.write("\nOperation cancelled.");
        process.exit(0);
      },
    },
  );

  const s = p.spinner();
  s.start("Generating config files");

  const forgejoAdminPassword = generatePassword();
  const envContent = generateEnvFile({
    domain: answers.domain,
    forgejoAdminUser: answers.forgejoAdminUser,
    forgejoAdminPassword,
    forgejoServicePassword: generatePassword(),
    jwtSecret: generateSecret(),
    dbPassword: generatePassword(),
  });

  const composeContent = generateDockerCompose({ domain: answers.domain });

  const outDir = process.cwd();
  await Promise.all([
    fs.writeFile(path.join(outDir, ".env"), envContent, "utf8"),
    fs.writeFile(path.join(outDir, "docker-compose.yml"), composeContent, "utf8"),
  ]);

  s.stop("Config files generated");

  p.note(
    [".env", "docker-compose.yml"].join("\n"),
    "Files written to current directory",
  );

  p.note(
    `${answers.forgejoAdminUser} / ${forgejoAdminPassword}`,
    "Forgejo admin credentials — save these",
  );

  p.outro(c.green("Done. Run embargo start to bring up services."));
}
export async function startCommand(...args: any[]): Promise<void> {}
export async function stopCommand(...args: any[]): Promise<void> {}
export async function statusCommand(...args: any[]): Promise<void> {}
