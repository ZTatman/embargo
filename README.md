# Myst

> My stuff, kept private.

Myst is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for code snapshots.

## Architecture

```mermaid
flowchart TB
    subgraph VPS["VPS / Self-Hosted"]
        subgraph Docker["Docker Network"]
            Forgejo["Forgejo (Git Server)"]
            Postgres["PostgreSQL (2 Databases)"]
            Myst["Myst (This Service)"]
            Traefik["Traefik (Reverse Proxy)"]
        end
        Tailscale["Tailscale (Admin Access)"]
    end

    subgraph External["External"]
        Owner["Repo Owner"]
        Viewer["Link Recipient"]
    end

    Owner -->|"Login via Forgejo Session"| Myst
    Owner -->|"Create View Link (PAT)"| Forgejo
    Myst -->|"Read-only API (PAT)"| Forgejo
    Myst -->|"Store Grants"| Postgres
    Forgejo -->|"Sessions"| Postgres
    Myst -->|"Public Viewer"| Viewer
    Myst -->|"Admin UI (Protected)"| Owner
    Tailscale -->|"Private Admin Access"| Myst
    Traefik -->|"Route HTTPS Traffic"| Myst
```

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
| Data Access | Service Account PAT |

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
- Forgejo service account username and PAT
- Grant token secret

### 2. Configure Service Account

Create a dedicated Forgejo user (e.g., `myst-bot`) with a PAT:

- `read:user`
- `read:repository`

### 3. Deploy

Deploy via Dokploy, Coolify, or your preferred platform.

## Example Configuration

```env
MYST_PUBLIC_URL="https://share.example.com"
MYST_ADMIN_URL="https://admin.example.com"
DATABASE_URL="postgresql://myst:secret@localhost:5432/myst"
FORGEJO_BASE_URL="https://git.example.com"
FORGEJO_SERVICE_ACCOUNT_USERNAME="myst-bot"
FORGEJO_PAT="fgp_xxxxxxxxxxxxxxxxxxxx"
GRANT_TOKEN_SECRET="your-secret-here"
```

## Phase 1 Progress

- [x] Project renamed from Embargo to Myst
- [x] CLI scaffold (`myst init`)
- [x] Config generation (`.env`, `myst.config.json`)
- [ ] `myst forgejo bootstrap` — verify Forgejo connectivity
- [ ] `myst doctor` — validate configuration
- [ ] `myst config print` — show current config
- [ ] Service foundation (PostgreSQL schema)
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
