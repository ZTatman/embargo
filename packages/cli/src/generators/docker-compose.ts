export function generateDockerCompose({ domain }: { domain: string }): string {
  return `services:
  postgres:
    container_name: postgres
    image: postgres:16
    restart: always
    env_file:
      - .env
    volumes:
      - postgres:/var/lib/postgresql/data
    networks:
      - private

  forgejo:
    container_name: forgejo
    image: codeberg.org/forgejo/forgejo:14
    restart: always
    env_file:
      - .env
    depends_on:
      - postgres
    ports:
      - "3000:3000"
      - "2222:22"
    volumes:
      - forgejo:/data
    networks:
      - private

  myst:
    container_name: myst
    image: node:22-alpine
    restart: always
    env_file:
      - .env
    depends_on:
      - forgejo
    ports:
      - "4000:4000"
    environment:
      MYST_DOMAIN: ${domain}
    networks:
      - private
      - public

networks:
  private:
    internal: true
  public:

volumes:
  postgres:
  forgejo:
`;
}
