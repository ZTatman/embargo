# Myst Phase 1 Design

This document captures the approved Phase 1 plan for Myst.

## Scope

Phase 1 delivers:

- CLI setup for attaching Myst to an existing Forgejo deployment
- Myst service foundation
- constrained Forgejo service-account integration
- immutable snapshot grants pinned to `commit_sha`
- owner dashboard and viewer flow
- two link types: private (email-verified) and public (time-expired)
- web-based code viewer (not git clone URLs)

Phase 1 does not deliver:

- Forgejo provisioning
- Forgejo database provisioning
- reverse proxy or DNS automation
- platform-specific hosting orchestration beyond optional templates and docs

## Reviewable Branches

1. `codex/phase1-bootstrap-monorepo`
2. `codex/phase1-cli-init-skeleton`
3. `codex/phase1-service-foundation`
4. `codex/phase1-forgejo-integration`
5. `codex/phase1-grants-viewer`
6. `codex/phase1-dashboard-logs-settings`

## Security Baseline

- service account access is restricted to approved repos
- Myst grant checks are enforced on every Forgejo read
- grants store `repo_id` and pinned `commit_sha`
- viewer requests never choose repo or ref directly
- operators create the Forgejo service account and PAT themselves
- Myst stores only its own app config and metadata in its own database
- admin access is protected upstream with Tailscale, VPN, Cloudflare Access, reverse-proxy auth, or equivalent operator-managed controls
- Myst does not ship built-in admin auth in Phase 1

## Authentication Model

Myst uses two authentication mechanisms:

**User Identity (Forgejo Sessions)**
- Users log in via Forgejo's session system
- Myst redirects to Forgejo login and validates the session
- Users use their existing Forgejo accounts — no separate Myst login
- All Forgejo users with an account are trusted Myst users

**Data Access (Service Account PAT)**
- Myst uses an operator-created service account PAT to call the Forgejo API
- PAT is used to verify repo ownership and fetch code for viewers
- PAT is never used for user identity (that's handled by sessions)

**Why both?**
- Sessions identify who the user is (zach@me.com logged in)
- PAT allows Myst to verify repo ownership (can zach@me.com create view links for this repo?)
- PAT allows Myst to fetch code content for the viewer (get the pinned commit's files)

## Forgejo Service Account Baseline

- the Forgejo service account is a normal Forgejo user account dedicated to Myst, such as `myst-bot`
- the operator creates this user in Forgejo and grants repo access explicitly
- the operator creates the PAT for this user through the Forgejo UI or admin CLI
- recommended PAT scopes are `read:user` and `read:repository`
- `read:organization` may also be required when repo visibility depends on org or team APIs
- Myst must not create Forgejo users, PATs, or repo permissions in Phase 1

## Link Types

Myst supports two types of view links:

### Private Links (Email-Verified)

- Time expired (configurable duration)
- Revocable by the owner
- Requires email verification code to view
- Tied to a specific email address
- Owner specifies the recipient's email when creating the link
- Myst sends an email with a verification code
- Viewer enters the code to access the snapshot

### Public Links (Time-Expired)

- Time expired (configurable duration)
- Revocable by the owner
- No verification required
- Anyone with the link can view
- Suitable for job application portfolio fields
- Owner copies the link and shares it directly

## Link Creation Rules

Only repo owners can create view links for their repos.

- Myst verifies ownership via the Forgejo API using the service account PAT
- Collaborators or read-access users cannot create view links
- Site admins are treated as regular users for this purpose (details to be finalized)

## CLI Init Baseline

`myst init` should ask only for:

- public viewer URL, for example `https://share.example.com`
- private admin URL, for example `https://admin.example.com` or `https://myst-admin.tailnet.ts.net`
- Forgejo base URL, for example `https://git.example.com`
- Myst Postgres URL, for example `postgresql://myst:password@db.example.com:5432/myst`
- Forgejo service account username, for example `myst-bot`
- Forgejo PAT for that service account
- grant token secret, with secure auto-generation as the default

`myst init` should generate all Myst-owned deployment config needed for Phase 1:

- `.env`
- `myst.config.json`
- any future Myst-only deployment templates, but never Forgejo provisioning files

`myst init` should provide inline guidance that:

- it should be run in the directory where Myst will be deployed, usually on the target VPS or server workspace
- the admin URL must be protected upstream because Myst does not provide admin auth in Phase 1
- the database URL must point to Myst's own Postgres database, not Forgejo's tables
- the PAT should be created for the dedicated service account user
- the operator can consult Forgejo docs for token creation and scopes if needed
- bare hostnames such as `share.example.com` are accepted and should default to `https://`

## Deployment Baseline

- Forgejo is already deployed and operator-managed
- Myst is deployed independently as its own app
- Myst uses its own Postgres database on the same DB server as Forgejo (separate database, not shared tables)
- Myst reaches Forgejo via API using a least-privilege service account token
- the CLI validates configuration and connectivity rather than provisioning infrastructure
- the Myst admin surface must be protected by VPN, Tailscale, Cloudflare Access, or reverse-proxy auth in front of the app

### Docker and Deployment

Myst provides a Dockerfile for containerized deployment:

- Myst includes a `Dockerfile` in its repository for building the container image
- Operators use their preferred platform (Dokploy, Coolify, manual Docker, etc.) to deploy the Myst container
- Myst does not generate Docker Compose files for Forgejo or other infrastructure
- Myst does not provision containers, images, or hosting resources
- Operators manage their own container orchestration (Dokploy handles this for most users)

For Dokploy users, deploying Myst is similar to deploying any other containerized application:

1. Build or import the Myst image using Dokploy's Docker Compose support
2. Configure environment variables from `.env` generated by `myst init`
3. Set up the public and admin domains in Dokploy's domain configuration
4. Dokploy handles Traefik routing, TLS, and container restarts

## Database Model

Myst uses its own Postgres database on the same DB server as Forgejo:

- separate databases (not shared tables with Forgejo)
- recommended: same PostgreSQL instance with `forgejo` and `myst` databases
- clean schema separation prevents coupling to Forgejo's database schema
- independent backups and migrations
- operators can run both databases on a small VPS efficiently

Minimum v1 data model:

- `grants`: view link metadata (repo, commit_sha, type, expiration, email, revoked)
- `verification_codes`: email verification codes for private links
- `sessions`: user sessions (validated against Forgejo)
- `smtp_config`: SMTP settings (encrypted)

## Forgejo Bootstrap Baseline

`myst forgejo bootstrap` should verify, not provision:

- Forgejo base URL reachability
- service account token validity
- authenticated user matches the configured service account username
- minimum token scopes are sufficient for Myst's read-only API usage
- Myst can resolve repo metadata, pinned commits, and tree/file reads for the repos it is expected to serve
- Myst can verify repo ownership for the operator's user account

## Viewer Baseline

The web-based viewer is the public-facing code display surface:

- displays code with syntax highlighting
- read-only, no raw git access
- validates link token, expiration, and revoked state
- for private links: requires valid email verification code
- for public links: accessible immediately with the link
- never exposes Forgejo admin surfaces or database ports
- pinned to immutable commit_sha (not moving branches)

## User Dashboard

The owner dashboard allows repo owners to manage their view links:

- list of created links (public and private)
- link status (active, expired, revoked)
- view count and access logs (details to be finalized)
- create new link flow
- revoke/delete existing links
- SMTP configuration page

First-time users see a quick setup page to configure SMTP credentials before accessing the full dashboard.
