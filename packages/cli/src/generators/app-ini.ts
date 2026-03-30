export function generateAppIni(): string {
  return `[service]
DISABLE_REGISTRATION = true
DEFAULT_ORG_VISIBILITY = private

[repository]
DEFAULT_PRIVATE = private
FORCE_PRIVATE = true

[server]
HTTP_PORT = 3000
`;
}

