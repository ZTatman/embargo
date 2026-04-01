export function generateExampleCaddyfile(domain: string): string {
  return `${domain} {
  reverse_proxy /_myst/* localhost:4000
  reverse_proxy localhost:3000
}
`;
}

export function generateExampleNginxConf(domain: string): string {
  return `server {
  server_name ${domain};

  location /_myst/ {
    proxy_pass http://127.0.0.1:4000/;
  }

  location / {
    proxy_pass http://127.0.0.1:3000/;
  }
}
`;
}
