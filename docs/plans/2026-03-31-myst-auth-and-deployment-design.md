# Myst Auth and Deployment Design

This document captures current decisions about deployment topology, authentication, and CLI scope for Phase 1.

## Goals

- Keep Myst self-hosted and private by default.
- Let operators attach Myst to an existing Forgejo deployment.
- Expose only the read-only share-link viewer and Myst UI routes the operator chooses to publish.
- Make the CLI responsible for Myst-specific configuration, validation, and Forgejo integration checks.
- Keep Phase 1 scope minimal and shippable.
- Prevent code theft and scraping by controlling who can view shared links and how.

## Non-Goals

- Built-in admin authentication in Myst for Phase 1.
- Provisioning Forgejo for operators.
- Provisioning PostgreSQL for Forgejo or Myst.
- Owning reverse proxy, DNS, TLS, backup, or firewall setup.
- Replacing Dokploy, Coolify, or any other hosting platform.
- Adding a SaaS control plane.
- Requiring end users to join Tailscale in order to view shared code.
- Designing a browser-based admin UX before the backend and integration flow exist.

## Core Architecture

Myst is a companion service deployed beside an existing Forgejo instance. It owns its own UI/API app and its own database, and it integrates with Forgejo only through the Forgejo API.

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
               Myst App (Viewer + Dashboard)
                         |
                  -------------------
                  |                 |
                  v                 v
           Myst Database     Forgejo API
           (Postgres)           (existing instance)
```

Deployment boundaries:

- Forgejo is already running and is managed by the operator.
- Myst is deployed independently from Forgejo.
- Myst never reads or writes Forgejo's database directly.
- Myst uses a service account PAT to call the Forgejo API.
- Myst uses Forgejo sessions to identify logged-in users.
- Myst admin access is protected upstream rather than by an in-app login system in Phase 1.
- VPN, Tailscale, Cloudflare Access, or reverse-proxy auth is required for the admin surface in Phase 1.

## Authentication

Myst uses two authentication mechanisms for different purposes:

### User Identity: Forgejo Sessions

Users log in via Forgejo's existing session system:

1. User visits Myst dashboard
2. Myst redirects to Forgejo login page
3. User authenticates with Forgejo credentials
4. Forgejo sets a session cookie
5. Myst validates the session via Forgejo API
6. Myst knows the user's identity without maintaining its own user database

**Benefits:**
- No separate Myst login — users use their existing Forgejo account
- All Forgejo users with an account are trusted Myst users
- No separate user management in Myst

### Data Access: Service Account PAT

Myst uses an operator-created PAT to call the Forgejo API:

1. Verify repo ownership when owner creates a view link
2. Fetch code content when serving view links to viewers

**Why both mechanisms?**
- Sessions identify the user (zach@me.com is logged in)
- PAT authorizes Myst's server-to-server API calls (fetch repo data, verify ownership)
- PAT is not used for user identity — that's the session's job

## Link Types

### Private Links (Email-Verified)

Intended for sharing with specific individuals via email.

**Creation:**
- Owner selects repo and commit_sha
- Owner enters recipient's email address
- Owner sets expiration time
- Myst generates a unique link token

**Viewer flow:**
1. Owner shares the link with the recipient (via email or copy)
2. Recipient clicks the link
3. Recipient enters email verification code from Myst's email
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

Myst is designed to prevent code theft and scraping:

- No public listing of repositories
- No profile exposure
- Private links require email verification
- Public links are time-limited and revocable
- Links are tied to immutable commit snapshots
- Cannot dig through repo list or browse content without a valid link

## Deployment

Myst should be deployable anywhere an operator can run a normal web app and Postgres database.

Recommended v1 deployment environments:

1. Same VPS or host as Forgejo (via Dokploy)
2. Same Dokploy project or private network as Forgejo
3. Separate host on the same trusted network as Forgejo

### Docker and Deployment

Myst provides a Dockerfile for containerized deployment:

- Myst includes a `Dockerfile` in its repository for building the container image
- Operators use their preferred platform (Dokploy, Coolify, manual Docker, etc.) to deploy the Myst container
- Myst does not generate Docker Compose files for Forgejo or other infrastructure
- Myst does not provision containers, images, or hosting resources
- Operators manage their own container orchestration

For Dokploy users, deploying Myst is similar to deploying any other containerized application:

1. Build or import the Myst image using Dokploy's Docker Compose support
2. Configure environment variables from `.env` generated by `myst init`
3. Set up the public and admin domains in Dokploy's domain configuration
4. Dokploy handles Traefik routing, TLS, and container restarts

### Database Configuration

Myst uses its own Postgres database on the same DB server as Forgejo:

- Separate databases (e.g., `forgejo` and `myst`)
- NOT shared tables or schemas
- Operators can run both on a small VPS efficiently
- Independent backups and migrations

Admin access security is the operator's responsibility (VPN, firewall rules, SSO, host access, etc). Myst does not enforce or scaffold this in Phase 1.

Recommended admin protection modes:

1. Tailscale or another private network
2. Cloudflare Access or similar identity-aware proxy
3. Reverse-proxy basic auth or IP allowlisting when the operator accepts the trade-offs

Recommended hostname split:

- `https://share.example.com` for the public viewer
- `https://admin.example.com` for the private admin UI

## CLI Responsibilities

The CLI is the primary way to configure and validate Myst against an existing Forgejo deployment.

### `init`

`init` should:

- prompt for the public viewer URL, for example `https://share.example.com`
- prompt for the private admin URL, for example `https://admin.example.com`
- prompt for the Forgejo base URL, for example `https://git.example.com`
- collect the Forgejo service account username, for example `myst-bot`
- collect a user-created Forgejo PAT for that service account
- collect Myst Postgres connection details, for example `postgresql://myst:password@db.example.com:5432/myst`
- generate a grant token secret by default unless the operator pastes one
- generate all Myst-owned config files needed for deployment in Phase 1
- write `.env`
- write `myst.config.json`
- print manual follow-up actions for admin URL protection, app deployment, and Forgejo validation
- show links to Forgejo docs for API usage, token scopes, repo permissions, and the admin CLI
- remind operators to run `myst init` in the directory where Myst will be deployed, usually on the target VPS or server workspace

**Setup is manual** — operators enter all values directly. No auto-detection of Forgejo configuration.

Suggested `init` prompt guidance:

- Public viewer URL: "What public URL should viewers use for shared links?" Example: `https://share.example.com`
- Private admin URL: "What private URL should operators use for the Myst admin UI?" Example: `https://admin.example.com`
- Forgejo base URL: "What is the base URL of your existing Forgejo instance?" Example: `https://git.example.com`
- Myst database URL: "What Postgres connection string should Myst use?" Example: `postgresql://myst:password@db.example.com:5432/myst`
- Forgejo service account username: "What Forgejo username should Myst use for API access?" Example: `myst-bot`
- Forgejo PAT: "Paste the Forgejo personal access token for that service account" Example: `fgp_...`
- Grant token secret: "Paste a grant token secret, or press enter to generate one automatically"

Suggested `init` prompt notes:

- "Protect the admin URL upstream with Tailscale, VPN, Cloudflare Access, or reverse-proxy auth. Myst does not provide admin auth in Phase 1."
- "Use a dedicated Forgejo user for Myst and create the PAT as that user."
- "Recommended PAT scopes: `read:user`, `read:repository`; add `read:organization` only if your org or team setup requires it."
- "Do not point Myst at Forgejo's database tables."
- "Bare hostnames such as `share.example.com` are accepted and default to `https://`. Enter the full URL only if you need `http://` or a custom path."
- "Run `myst init` in the directory where you plan to deploy Myst so the generated files are already in place on the target host."

Forgejo docs to link directly from CLI output:

- `https://forgejo.org/docs/latest/user/api-usage/`
- `https://forgejo.org/docs/latest/user/token-scope/`
- `https://forgejo.org/docs/latest/user/repo-permissions/`
- `https://forgejo.org/docs/latest/admin/command-line/`

### `forgejo bootstrap`

`forgejo bootstrap` should:

- validate Forgejo connectivity
- validate the provided service account token
- verify minimum required scopes and permissions
- confirm Myst can resolve the repos it needs
- confirm the authenticated user matches the configured service account username
- confirm Myst can resolve a branch or ref to a pinned `commit_sha`
- confirm Myst can read tree and file data for a pinned commit
- verify Myst can confirm repo ownership for the operator's user account
- never create Forgejo users, PATs, or repo permissions

### `doctor`

`doctor` should:

- validate the local Myst config
- validate database connectivity
- validate Forgejo API reachability
- validate token/scopes/permissions
- validate the public base URL and key route assumptions

### `config print`

`config print` should:

- show resolved Myst configuration
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
- `myst.config.json`
- optional platform templates for Myst only (e.g., Docker Compose for Dokploy)

## Data Model

Myst stores its metadata in its own Postgres database (separate from Forgejo's database).

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
  - Select repo (fetched via service account PAT, filtered to owned repos)
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

## Repo Implementation Impact

Active surfaces:

- CLI entrypoint: `packages/cli/src/index.ts`
- Command stubs: `packages/cli/src/commands/*`
- Config generators: `packages/cli/src/generators/*`
- Shared constants/types: `packages/shared/src/*`
- Service entrypoint: `packages/service/src/index.ts`
- Viewer routes: `packages/service/src/viewer/*`
- Dashboard routes: `packages/service/src/dashboard/*`

Next implementation work:

1. Narrow `init` to Myst-only config generation for an existing Forgejo deployment
2. Add config types for Forgejo connection details, Myst base URL, database, and SMTP settings
3. Implement `forgejo bootstrap` and `doctor`
4. Add Postgres-backed service foundation using the data model
5. Wire the service to load generated config and validate required env at startup
6. Implement Forgejo session authentication for the dashboard
7. Build the link creation flow with repo ownership verification
8. Implement the web-based code viewer
9. Build the user dashboard with access logs
10. Implement email sending for private link verification codes
