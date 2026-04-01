interface EnvOptions {
  dbPassword: string;
  domain: string;
  forgejoAdminPassword: string;
  forgejoAdminUser: string;
  forgejoServicePassword: string;
  jwtSecret: string;
}

export function generateEnvFile(options: EnvOptions): string {
  return `EMBARGO_DOMAIN=${options.domain}
JWT_SECRET=${options.jwtSecret}

FORGEJO_ADMIN_USERNAME=${options.forgejoAdminUser}
FORGEJO_ADMIN_PASSWORD=${options.forgejoAdminPassword}
FORGEJO_SERVICE_ACCOUNT=embargo-bot
FORGEJO_SERVICE_ACCOUNT_PASSWORD=${options.forgejoServicePassword}

POSTGRES_DB=forgejo
POSTGRES_USER=forgejo
POSTGRES_PASSWORD=${options.dbPassword}
`;
}
