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

### 1. Run `myst init`

```bash
myst init
```

Prompts for:

- Public viewer URL (`share.example.com`)
- Private admin URL (`admin.example.com`)
- Forgejo base URL (`git.example.com`)
- PostgreSQL connection string
- Dedicated Forgejo username and PAT
- Grant token secret

### 2. Configure Dedicated Forgejo User

Create a dedicated Forgejo user (e.g., `myst-bot`) with a PAT:

- `read:user`
- `read:repository`

### 3. Deploy

Deploy Myst anywhere you can run a normal web app beside Forgejo. Phase 1 should explicitly support both of these examples:

- VPS deployment: Hostinger or another VPS with Dokploy, Traefik, UFW, Myst, Forgejo, and a shared Postgres instance that contains separate `forgejo` and `myst` databases.
- Self-hosted server deployment: a home server, mini PC, NAS, or other self-hosted Linux machine running Myst with Docker, Podman, Docker Compose, Coolify, Caddy, Nginx, or another reverse proxy.

Myst should not assume a VPS-only environment. The requirement is an existing Forgejo instance, Myst's own database, and a way to route the public and admin hostnames to the Myst app.

## Example Configuration

```env
MYST_PUBLIC_URL="https://share.example.com"
MYST_ADMIN_URL="https://admin.example.com"
DATABASE_URL="postgresql://myst:secret@localhost:5432/myst"
FORGEJO_BASE_URL="https://git.example.com"
FORGEJO_BOT_USERNAME="myst-bot"
FORGEJO_PAT="fgp_xxxxxxxxxxxxxxxxxxxx"
GRANT_TOKEN_SECRET="your-secret-here"
```

## Phase 1 Progress

- [x] Project renamed from Embargo to Myst
- [x] CLI scaffold (`myst init`)
- [x] Config generation (`.env`, `myst.config.json`)
- [ ] Service foundation (FastAPI + PostgreSQL)
- [ ] `myst forgejo bootstrap` — verify Forgejo connectivity
- [ ] `myst doctor` — validate configuration
- [ ] `myst config print` — show current config
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
