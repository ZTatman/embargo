interface EnvOptions {
  adminUrl: string;
  databaseUrl: string;
  forgejoBaseUrl: string;
  forgejoPat: string;
  forgejoServiceAccountUsername: string;
  grantTokenSecret: string;
  publicUrl: string;
}

export function generateEnvFile(options: EnvOptions): string {
  return `# Public URL used for share links.
MYST_PUBLIC_URL=${options.publicUrl}

# Private operator URL for the admin UI. Protect this upstream.
MYST_ADMIN_URL=${options.adminUrl}

# Myst's own Postgres database.
DATABASE_URL=${options.databaseUrl}

# Existing Forgejo instance and operator-created service account token.
FORGEJO_BASE_URL=${options.forgejoBaseUrl}
FORGEJO_SERVICE_ACCOUNT_USERNAME=${options.forgejoServiceAccountUsername}
FORGEJO_PAT=${options.forgejoPat}

# Secret used to sign or derive grant tokens.
GRANT_TOKEN_SECRET=${options.grantTokenSecret}
`;
}
