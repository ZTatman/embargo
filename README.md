# Myst

> My stuff, kept private.

Myst is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for code snapshots.

## System Diagram

This diagram shows how traffic moves through the public internet, the VPS or self-hosted server, the host firewall, the platform router, Myst, Forgejo, and Postgres.

[![Myst system routing diagram](docs/diagrams/system-routing.svg)](docs/diagrams/system-routing.svg)

Click the diagram to open the full-size SVG.

## Features

### Two Link Types

| Type | Verification | Use Case |
|------|--------------|----------|
| **Private** | Email verification code required | Share with specific individuals |
| **Public** | No verification, time-expired | Job applications, portfolios |

### Security

- Links pinned to immutable `commit_sha` — not moving branches
- Email verification prevents unauthorized access
- Time-expiration and revocation give owners control
- No public repo listing — anti-scraping by design
- Admin access protected upstream (Tailscale, VPN, Cloudflare Access)

### Authentication

| Purpose | Method |
|---------|--------|
| User Identity | Forgejo Sessions |
| Data Access | Dedicated Forgejo User PAT |

### Tech Stack

- **Backend**: Python + FastAPI
- **Frontend**: Jinja2 templates + HTMX (no build step)
- **Database**: PostgreSQL

HTMX provides interactivity (filtering, form submissions) with minimal JavaScript. Jinja2 handles server-side rendering for fast page loads.

## Quick Start

### 1. Run `myst config init`

```bash
myst config init
```

Prompts for:

- Forgejo base URL (`git.example.com`)
- Forgejo PAT (with `read:user` and `read:repository` scopes)

### 2. Deploy with Docker Compose

```bash
cd packages/cli/examples
cp docker-compose.example.yml docker-compose.yml
# Edit .env with your FORGEJO_BASE_URL and FORGEJO_PAT
docker compose up -d
```

The DATABASE_URL is injected automatically by Docker Compose.

### 3. Alternative Deployments

For non-Docker deployments, you must supply DATABASE_URL yourself:

- VPS deployment: Hostinger or another VPS with Dokploy, Traefik, UFW, Myst, Forgejo, and a shared Postgres instance that contains separate `forgejo` and `myst` databases.
- Self-hosted server deployment: a home server, mini PC, NAS, or other self-hosted Linux machine running Myst with Docker, Podman, Docker Compose, Coolify, Caddy, Nginx, or another reverse proxy.

Myst should not assume a VPS-only environment. The requirement is an existing Forgejo instance, Myst's own database, and a way to route the public and admin hostnames to the Myst app.

## Example Configuration

Create a `.env` file with:

```env
FORGEJO_BASE_URL="https://git.example.com"
FORGEJO_PAT="forgejo_pat_xxxxxxxxxxxx"
```

When using the provided Docker Compose example, DATABASE_URL is injected automatically. For other deployment approaches (e.g., bare metal, Kubernetes), you must supply DATABASE_URL yourself.

## Phase 1 Progress

- [x] Project renamed from Embargo to Myst
- [x] CLI scaffold (`myst config init`)
- [x] Config generation (`.env`)
- [ ] Service foundation (FastAPI + PostgreSQL)
- [x] `myst config verify` — verify Forgejo connectivity
- [x] `myst config verify --diagnostic` — comprehensive diagnostics
- [x] `myst config view` — show current config
- [ ] Forgejo session authentication
- [ ] Repo ownership verification
- [ ] Private link creation (email-verified)
- [ ] Public link creation (time-expired)
- [ ] Web-based code viewer
- [ ] User dashboard
- [ ] SMTP configuration UI
- [ ] Access logs

## Resources

- [Forgejo Docs](https://forgejo.org/docs/)
- [API Usage](https://forgejo.org/docs/latest/user/api-usage/)
- [Token Scopes](https://forgejo.org/docs/latest/user/token-scope/)
