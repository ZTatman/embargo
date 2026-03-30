export function generateDockerCompose({ domain }: { domain: string }): string {
  return `services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - postgres-data:/var/lib/postgresql/data

  forgejo:
    image: codeberg.org/forgejo/forgejo:11.0.11
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - postgres
    ports:
      - "3000:3000"
      - "2222:22"
    volumes:
      - ./forgejo/app.ini:/data/gitea/conf/app.ini

  embargo-service:
    image: node:22-alpine
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - forgejo
    ports:
      - "4000:4000"
    environment:
      EMBARGO_DOMAIN: ${domain}
    volumes:
      - embargo-data:/data

volumes:
  postgres-data:
  embargo-data:
`;
}

