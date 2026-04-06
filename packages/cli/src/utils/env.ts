interface EnvOptions {
  adminUrl: string;
  databaseUrl: string;
  forgejoBaseUrl: string;
  forgejoBotUsername: string;
  forgejoPat: string;
  grantTokenSecret: string;
  publicUrl: string;
}

function escapeEnvValue(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\r?\n/g, "\\n")}"`; // Escape newlines
}

/**
 * Generates an .env file for Myst with the given options.
 * @param options - The options for generating the .env file.
 * @returns {string} The .env file formatted as a string.
 */
export function generateEnvFile(options: EnvOptions): string {
  return `# Public URL used for share links.
MYST_PUBLIC_URL=${escapeEnvValue(options.publicUrl)}

# Private operator URL for the admin UI. Protect this upstream.
MYST_ADMIN_URL=${escapeEnvValue(options.adminUrl)}

# Myst's own Postgres database.
DATABASE_URL=${escapeEnvValue(options.databaseUrl)}

# Existing Forgejo instance and operator-created PAT for the dedicated Forgejo user.
FORGEJO_BASE_URL=${escapeEnvValue(options.forgejoBaseUrl)}
FORGEJO_BOT_USERNAME=${escapeEnvValue(options.forgejoBotUsername)}
FORGEJO_PAT=${escapeEnvValue(options.forgejoPat)}

# Secret used to sign or derive grant tokens.
GRANT_TOKEN_SECRET=${escapeEnvValue(options.grantTokenSecret)}
`;
}
