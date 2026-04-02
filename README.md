# Myst

My stuff, kept private.

Myst is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for private code snapshots.

## Architecture

```mermaid
flowchart TB
    subgraph VPS["VPS / Self-Hosted"]
        subgraph Docker["Docker Network"]
            Forgejo["Forgejo<br/>(Git Server)"]
            Postgres["PostgreSQL<br/>(2 Databases)"]
            Myst["Myst<br/>(This Service)"]
            Traefik["Traefik<br/>(Reverse Proxy)"]
        end
        
        Tailscale["Tailscale<br/>(Admin Access)"]
    end
    
    subgraph External["External"]
        Owner["Repo Owner<br/>(Browser)"]
        Viewer["Viewer<br/>(Link Recipient)"]
    end
    
    Owner -->|"Login via Forgejo<br/>Session"| Myst
    Owner -->|"Create View Link<br/>API calls w/ PAT"| Forgejo
    Myst -->|"Read-only API<br/>Service Account PAT"| Forgejo
    Myst -->|"Store Grants<br/>Own Database"| Postgres
    Forgejo -->|"Sessions"| Postgres
    
    Myst -->|"Public Viewer<br/>share.example.com"| Viewer
    Myst -->|"Admin UI<br/>admin.example.com<br/>(Protected)"| Owner
    
    Tailscale -->|"Private Admin<br/>Access"| Myst
    Traefik -->|"Route HTTPS<br/>Traffic"| Myst
end
```

## Features

### Two Link Types

| Type | Verification | Use Case |
|------|--------------|----------|
| **Private** | Email verification code required | Share with specific individuals |
| **Public** | No verification, time-expired | Job applications, portfolios |

### Security Model

- Share links are **pinned to `commit_sha`** — immutable, not moving branches
- **Email-verified links** prevent unauthorized access
- **Time-expiration and revocation** give owners control
- **No public repo listing** — anti-scraping by design
- Admin access protected by **upstream controls** (Tailscale, VPN, Cloudflare Access)

### Authentication

Myst uses two mechanisms:

| Purpose | Method | Who |
|---------|--------|-----|
| User Identity | Forgejo Sessions | Repo owners log in via Forgejo |
| Data Access | Service Account PAT | Myst fetches code from Forgejo API |

## Setup

### Prerequisites

- Forgejo instance (self-hosted or managed)
- PostgreSQL database
- Domain names for viewer and admin
- SMTP server for email verification

### 1. Run `myst init`

```bash
# On your VPS, in the deployment directory
myst init
```

You'll be prompted for:

- Public viewer URL (e.g., `share.example.com`)
- Private admin URL (e.g., `admin.example.com`)
- Forgejo base URL (e.g., `git.example.com`)
- PostgreSQL connection string
- Forgejo service account username and PAT
- Grant token secret

### 2. Configure Service Account

Create a dedicated Forgejo user (e.g., `myst-bot`) and generate a PAT with:

- `read:user`
- `read:repository`

### 3. Deploy

Deploy the Myst container using Dokploy, Coolify, or your preferred platform.

## Example Configuration

### `.env` (generated)

```env
MYST_PUBLIC_URL="https://share.example.com"
MYST_ADMIN_URL="https://admin.example.com"
DATABASE_URL="postgresql://myst:secret@localhost:5432/myst"
FORGEJO_BASE_URL="https://git.example.com"
FORGEJO_SERVICE_ACCOUNT_USERNAME="myst-bot"
FORGEJO_PAT="fgp_xxxxxxxxxxxxxxxxxxxx"
GRANT_TOKEN_SECRET="generate-or-paste-a-secret"
```

### `myst.config.json` (generated)

```json
{
  "publicUrl": "https://share.example.com",
  "adminUrl": "https://admin.example.com",
  "forgejoBaseUrl": "https://git.example.com",
  "forgejoServiceAccountUsername": "myst-bot"
}
```

## Phase 1 Checklist

- [x] Project renamed from Embargo to Myst
- [x] CLI scaffold (`myst init`)
- [x] Config generation (`.env`, `myst.config.json`)
- [x] URL validation and normalization
- [x] Docker Compose generator removed (out of scope)
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

## Links

- [Forgejo Docs](https://forgejo.org/docs/)
- [API Usage](https://forgejo.org/docs/latest/user/api-usage/)
- [Token Scopes](https://forgejo.org/docs/latest/user/token-scope/)
- [Repo Permissions](https://forgejo.org/docs/latest/user/repo-permissions/)

## License

Apache 2.0
