# Myst Phase 1 Design

This document captures the approved Phase 1 plan for Myst.

## Scope

Phase 1 delivers:

- CLI setup for attaching Myst to an existing Forgejo deployment
- Myst service foundation
- constrained Forgejo service-account integration
- immutable snapshot grants pinned to `commit_sha`
- owner dashboard and viewer flow

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

## Forgejo Service Account Baseline

- the Forgejo service account is a normal Forgejo user account dedicated to Myst, such as `myst-bot`
- the operator creates this user in Forgejo and grants repo access explicitly
- the operator creates the PAT for this user through the Forgejo UI or admin CLI
- recommended PAT scopes are `read:user` and `read:repository`
- `read:organization` may also be required when repo visibility depends on org or team APIs
- Myst must not create Forgejo users, PATs, or repo permissions in Phase 1

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
- Myst uses its own Postgres database
- Myst reaches Forgejo via API using a least-privilege service account token
- the CLI validates configuration and connectivity rather than provisioning infrastructure
- the Myst admin surface must be protected by VPN, Tailscale, Cloudflare Access, or reverse-proxy auth in front of the app

## Forgejo Bootstrap Baseline

`myst forgejo bootstrap` should verify, not provision:

- Forgejo base URL reachability
- service account token validity
- authenticated user matches the configured service account username
- minimum token scopes are sufficient for Myst's read-only API usage
- Myst can resolve repo metadata, pinned commits, and tree/file reads for the repos it is expected to serve
