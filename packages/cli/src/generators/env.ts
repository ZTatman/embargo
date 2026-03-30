interface EnvOptions {
  dbPassword: string;
  domain: string;
  embargoAdminPassword: string;
  forgejoAdminPassword: string;
  forgejoAdminUser: string;
  forgejoServicePassword: string;
  jwtSecret: string;
  visibilityMode: "allowlist" | "team";
}

export function generateEnvFile(options: EnvOptions): string {
  return `EMBARGO_DOMAIN=${options.domain}
EMBARGO_ADMIN_PASSWORD=${options.embargoAdminPassword}
JWT_SECRET=${options.jwtSecret}

FORGEJO_ADMIN_USERNAME=${options.forgejoAdminUser}
FORGEJO_ADMIN_PASSWORD=${options.forgejoAdminPassword}
FORGEJO_SERVICE_ACCOUNT=embargo-bot
FORGEJO_SERVICE_ACCOUNT_PASSWORD=${options.forgejoServicePassword}
FORGEJO_VISIBILITY_MODE=${options.visibilityMode}

POSTGRES_DB=forgejo
POSTGRES_USER=forgejo
POSTGRES_PASSWORD=${options.dbPassword}
`;
}

