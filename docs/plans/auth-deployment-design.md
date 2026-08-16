# Firebreak Auth and Deployment Design

This document captures current decisions about deployment topology, authentication, and CLI scope for Phase 1.

## Goals

- Keep Firebreak self-hosted and private by default.
- Let operators attach Firebreak to an existing Forgejo deployment.
- Expose only the read-only share-link viewer and Firebreak UI routes the operator chooses to publish.
- Make the CLI responsible for Firebreak-specific configuration, validation, and Forgejo integration checks.
- Keep Phase 1 scope minimal and shippable.
- Prevent code theft and scraping by controlling who can view shared links and how.

## Non-Goals

- Built-in admin authentication in Firebreak for Phase 1.
- Provisioning Forgejo for operators.
- Provisioning PostgreSQL for Forgejo or Firebreak.
- Owning reverse proxy, DNS, TLS, backup, or firewall setup.
- Replacing Dokploy, Coolify, or any other hosting platform.
- Adding a SaaS control plane.
- Requiring end users to join Tailscale in order to view shared code.
- Designing a browser-based admin UX before the backend and integration flow exist.

## Core Architecture

Firebreak is a companion service deployed beside an existing Forgejo instance. It owns its own UI/API app and its own database, and it integrates with Forgejo only through the Forgejo API.

```ascii
                   Public Internet
                         |
                         v
               DNS: share.example.com (viewer)
               DNS: admin.example.com (dashboard, protected)
                         |
                         v
               Reverse Proxy / Platform Router
                 (Dokploy, Caddy, Nginx, etc.)
                         |
                         v
               Firebreak App (Viewer + Dashboard)
                         |
                  -------------------
                  |                 |
                  v                 v
           Firebreak Database     Forgejo API
           (Postgres)           (existing instance)
```ascii

Deployment boundaries:

- Forgejo is already running and is managed by the operator.
- Firebreak is deployed independently from Forgejo.
- Firebreak never reads or writes Forgejo's database directly.
- Firebreak uses a PAT created for a dedicated Forgejo user to call the Forgejo API.
- Firebreak uses Forgejo sessions to identify logged-in users.
- Firebreak admin access is protected upstream rather than by an in-app login system in Phase 1.
- VPN, Tailscale, Cloudflare Access, or reverse-proxy auth is required for the admin surface in Phase 1.

## Authentication

Firebreak uses two authentication mechanisms for different purposes:

### User Identity: Forgejo Sessions

Users log in via Forgejo's existing session system:

1. User visits Firebreak dashboard
2. Firebreak redirects to Forgejo login page
3. User authenticates with Forgejo credentials
4. Forgejo sets a session cookie
5. Firebreak validates the session via Forgejo API
6. Firebreak knows the user's identity without maintaining its own user database

**Benefits:**
- No separate Firebreak login — users use their existing Forgejo account
- All Forgejo users with an account are trusted Firebreak users
- No separate user management in Firebreak

### Data Access: Dedicated Forgejo User PAT

Firebreak uses an operator-created PAT to call the Forgejo API:

1. Verify repo ownership when owner creates a view link
2. Fetch code content when serving view links to viewers

**Why both mechanisms?**
- Sessions identify the user (zach@me.com is logged in)
- PAT authorizes Firebreak's server-to-server API calls (fetch repo data, verify ownership)
- PAT is not used for user identity — that's the session's job

## Link Types

### Private Links (Email-Verified)

Intended for sharing with specific individuals via email.

**Creation:**
- Owner selects repo and commit_sha
- Owner enters recipient's email address
- Owner sets expiration time
- Firebreak generates a unique link token

**Viewer flow:**
1. Owner shares the link with the recipient (via email or copy)
2. Recipient clicks the link
3. Recipient enters email verification code from Firebreak's email
4. On successful verification, recipient can view the code snapshot

**Protections:**
- Link is useless to anyone without the verification code
- Cannot scrape or index the content
- Owner can revoke access at any time

### Public Links (Time-Expired)

Intended for job applications, portfolios, and public sharing.

**Creation:**
- Owner selects repo and commit_sha
- Owner sets expiration time (e.g., 7 days)
- No email required

**Viewer flow:**
1. Owner copies the link
2. Pastes into a job application field or shares publicly
3. Anyone with the link can view immediately (no verification)

**Protections:**
- Link expires automatically
- Owner can revoke at any time
- No public listing of repos or profiles

## Anti-Scraping Protections

Firebreak is designed to prevent code theft and scraping:

- No public listing of repositories
- No profile exposure
- Private links require email verification
- Public links are time-limited and revocable
- Links are tied to immutable commit snapshots
- Cannot dig through repo list or browse content without a valid link

## Deployment

Firebreak should be deployable anywhere an operator can run a normal web app and Postgres database.

Recommended v1 deployment environments:

1. Same VPS or host as Forgejo (via Dokploy)
2. Same Dokploy project or private network as Forgejo
3. Separate host on the same trusted network as Forgejo

### Docker and Deployment

Firebreak provides a Dockerfile for containerized deployment:

- Firebreak includes a `Dockerfile` in its repository for building the container image
- Operators use their preferred platform (Dokploy, Coolify, manual Docker, etc.) to deploy the Firebreak container
- Firebreak does not generate Docker Compose files for Forgejo or other infrastructure
- Firebreak does not provision containers, images, or hosting resources
- Operators manage their own container orchestration

For Dokploy users, deploying Firebreak is similar to deploying any other containerized application:

1. Build or import the Firebreak image using Dokploy's Docker Compose support
2. Configure environment variables from `.env` generated by `firebreak init`
3. Set up the public and admin domains in Dokploy's domain configuration
4. Dokploy handles Traefik routing, TLS, and container restarts

### Database Configuration

Firebreak uses its own Postgres database on the same DB server as Forgejo:

- Separate databases (e.g., `forgejo` and `firebreak`)
- NOT shared tables or schemas
- Operators can run both on a small VPS efficiently
- Independent backups and migrations

Admin access security is the operator's responsibility (VPN, firewall rules, SSO, host access, etc). Firebreak does not enforce or scaffold this in Phase 1.

Recommended admin protection modes:

1. Tailscale or another private network
2. Cloudflare Access or similar identity-aware proxy
3. Reverse-proxy basic auth or IP allowlisting when the operator accepts the trade-offs

Recommended hostname split:

- `https://share.example.com` for the public viewer
- `https://admin.example.com` for the private admin UI

## CLI Responsibilities

The CLI is the primary way to configure and validate Firebreak against an existing Forgejo deployment.

### `init`

`init` should:

- prompt for the public viewer URL, for example `https://share.example.com`
- prompt for the private admin URL, for example `https://admin.example.com`
- prompt for the Forgejo base URL, for example `https://git.example.com`
- collect the dedicated Forgejo username Firebreak should use for API access, for example `firebreak-bot`
- collect a user-created Forgejo PAT for that dedicated Forgejo user
- collect Firebreak Postgres connection details, for example `postgresql://firebreak:password@db.example.com:5432/firebreak`
- generate a grant token secret by default unless the operator pastes one
- generate all Firebreak-owned config files needed for deployment in Phase 1
- write `.env`
- print manual follow-up actions for admin URL protection, app deployment, and Forgejo validation
- show links to Forgejo docs for API usage, token scopes, repo permissions, and the admin CLI
- remind operators to run `firebreak init` in the directory where Firebreak will be deployed, usually on the target VPS or server workspace

**Setup is manual** — operators enter all values directly. No auto-detection of Forgejo configuration.

Suggested `init` prompt guidance:

- Public viewer URL: "What public URL should viewers use for shared links?" Example: `https://share.example.com`
- Private admin URL: "What private URL should operators use for the Firebreak admin UI?" Example: `https://admin.example.com`
- Forgejo base URL: "What is the base URL of your existing Forgejo instance?" Example: `https://git.example.com`
- Firebreak database URL: "What Postgres connection string should Firebreak use?" Example: `postgresql://firebreak:password@db.example.com:5432/firebreak`
- Dedicated Forgejo username: "What Forgejo username should Firebreak use for API access?" Example: `firebreak-bot`
- Forgejo PAT: "Paste the Forgejo personal access token for that dedicated Forgejo user" Example: `fgp_...`
- Grant token secret: "Paste a grant token secret, or press enter to generate one automatically"

Suggested `init` prompt notes:

- "Protect the admin URL upstream with Tailscale, VPN, Cloudflare Access, or reverse-proxy auth. Firebreak does not provide admin auth in Phase 1."
- "Use a dedicated Forgejo user for Firebreak and create the PAT as that user."
- "Recommended PAT scopes: `read:user`, `read:repository`; add `read:organization` only if your org or team setup requires it."
- "Do not point Firebreak at Forgejo's database tables."
- "Bare hostnames such as `share.example.com` are accepted and default to `https://`. Enter the full URL only if you need `http://` or a custom path."
- "Run `firebreak init` in the directory where you plan to deploy Firebreak so the generated files are already in place on the target host."

Forgejo docs to link directly from CLI output:

- `https://forgejo.org/docs/latest/user/api-usage/`
- `https://forgejo.org/docs/latest/user/token-scope/`
- `https://forgejo.org/docs/latest/user/repo-permissions/`
- `https://forgejo.org/docs/latest/admin/command-line/`

### `forgejo bootstrap`

`forgejo bootstrap` should:

- validate Forgejo connectivity
- validate the provided dedicated Forgejo user token
- verify minimum required scopes and permissions
- confirm Firebreak can resolve the repos it needs
- confirm the authenticated user matches the configured dedicated Forgejo username
- confirm Firebreak can resolve a branch or ref to a pinned `commit_sha`
- confirm Firebreak can read tree and file data for a pinned commit
- verify Firebreak can confirm repo ownership for the operator's user account
- never create Forgejo users, PATs, or repo permissions

### `doctor`

`doctor` should:

- validate the local Firebreak config
- validate database connectivity
- validate Forgejo API reachability
- validate token/scopes/permissions
- validate the public base URL and key route assumptions

### `config print`

`config print` should:

- show resolved Firebreak configuration
- redact secrets by default
- help operators debug misconfiguration without touching infrastructure

### CLI UX

- Use spinners for long-running steps.
- Use prompts for interactive configuration.
- Keep output terse and actionable.
- Present required manual follow-up actions clearly after initialization.

## Configuration Outputs

Expected outputs from `init`:

- `.env`
- optional platform templates for Firebreak only (e.g., Docker Compose for Dokploy)

## Data Model

Firebreak stores its metadata in its own Postgres database (separate from Forgejo's database).

Minimum v1 data model:

- `grants`: view link metadata (repo_id, commit_sha, type, expiration, email, revoked, created_by)
- `verification_codes`: email verification codes for private links (code, email, grant_id, expires_at)
- `sessions`: user sessions (session_token, forgejo_user_id, created_at, expires_at)
- `smtp_config`: SMTP settings (encrypted, configured via dashboard)

Key constraints:

- grants are tied to immutable commit snapshots
- viewer endpoints never accept arbitrary repo/ref selection
- link tokens are unique and unguessable
- verification codes expire quickly (e.g., 15 minutes)

## User Dashboard

The owner dashboard provides:

- List of created links (public and private)
- Link status (active, expired, revoked)
- View count and access logs (details to be finalized)
- Create new link flow:
  - Select repo (fetched via the dedicated Forgejo user's PAT, filtered to owned repos)
  - Select commit (branch/tag to SHA resolution)
  - Choose link type (public or private)
  - Set expiration
  - For private: enter recipient email
- Revoke/delete existing links
- SMTP configuration page

**First-time setup:**
- After logging in via Forgejo, users see a quick setup page to configure SMTP credentials
- Once configured, full dashboard access is granted

## Viewer Rules

The viewer is the only public application surface that emits code content.

- Share links are tied to immutable snapshots (commit_sha)
- Viewer requests must validate:
  - link token
  - expiration
  - revoked state
  - snapshot binding
  - for private links: valid email verification code
- Public access must be read-only
- Public access must not expose database ports or Forgejo admin surfaces

## Active Surfaces

- CLI entrypoint: `cli/src/index.ts`
- Command stubs: `cli/src/commands/*`
- Web app: `web/app/` (FastAPI + Jinja2)
- Web routers: `web/app/routers/*`
- Web models: `web/app/models/*`

## Next implementation work

1. Implement Forgejo session authentication for the dashboard
2. Build the link creation flow with repo ownership verification
3. Implement the web-based code viewer
4. Build the user dashboard with access logs
5. Implement email sending for private link verification codes
