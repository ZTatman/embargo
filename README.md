# Firebreak

> Fight fire with fire. Your code. Your rules.

Firebreak is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for code snapshots.

## System Diagram

This diagram shows how traffic moves through the public internet, the VPS or self-hosted server, the host firewall, the platform router, Firebreak, Forgejo, and Postgres.

[![Firebreak system routing diagram](docs/diagrams/system-routing.svg)](docs/diagrams/system-routing.svg)

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
| User Identity | Forgejo OAuth |
| Data Access | User's Forgejo PAT |

### Tech Stack

- **Backend**: Python + FastAPI
- **Frontend**: Jinja2 templates + HTMX (no build step)
- **Database**: PostgreSQL

HTMX provides interactivity (filtering, form submissions) with minimal JavaScript. Jinja2 handles server-side rendering for fast page loads.

## Quick Start

### 1. Deploy with Docker Compose

```bash
docker compose up -d
```

### 2. Run the Setup Wizard

Open `http://localhost:8000` in your browser. On first boot, Firebreak redirects to a setup wizard where you configure:

- **Forgejo instance URL** — where your Forgejo server lives
- **OAuth credentials** — register an OAuth application in Forgejo first (Settings → Applications → Create OAuth2 Application), then paste the Client ID and Client Secret
- **Public base URL** (optional) — your production domain for OAuth redirects

The setup wizard auto-generates an encryption key for token storage.

### 3. Sign In and Register Your Token

After setup, sign in with your Forgejo account via OAuth. On first login, Firebreak prompts you to register a `read:repository`-scoped Personal Access Token (PAT) to enable share link viewing.

### 4. Alternative Deployments

For non-Docker deployments, supply `DATABASE_URL` yourself:

- VPS deployment: Hostinger or another VPS with Dokploy, Traefik, UFW, Firebreak, Forgejo, and a shared Postgres instance that contains separate `forgejo` and `firebreak` databases.
- Self-hosted server deployment: a home server, mini PC, NAS, or other self-hosted Linux machine running Firebreak with Docker, Podman, Docker Compose, Coolify, Caddy, Nginx, or another reverse proxy.

Firebreak should not assume a VPS-only environment. The requirement is an existing Forgejo instance, Firebreak's own database, and a way to route the public and admin hostnames to the Firebreak app.

## Phase 1 Progress

- [x] Project renamed from Embargo to Firebreak
- [x] CLI scaffold (`firebreak config init`)
- [x] Config generation (`.env`)
- [ ] Service foundation (FastAPI + PostgreSQL)
- [x] `firebreak config verify` — verify Forgejo connectivity
- [x] `firebreak config verify --diagnostic` — comprehensive diagnostics
- [x] `firebreak config view` — show current config
- [x] Forgejo OAuth authentication
- [ ] Repo ownership verification
- [ ] Private link creation (email-verified)
- [ ] Public link creation (time-expired)
- [ ] Web-based code viewer
- [x] User dashboard
- [ ] SMTP configuration UI
- [ ] Access logs

## Resources

- [Forgejo Docs](https://forgejo.org/docs/)
- [API Usage](https://forgejo.org/docs/latest/user/api-usage/)
- [Token Scopes](https://forgejo.org/docs/latest/user/token-scope/)
