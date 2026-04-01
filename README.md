# Myst

My stuff, kept private.

Myst is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for private code snapshots.

## Phase 1 PR Breakdown

Phase 1 is split into these reviewable branches:

1. `codex/phase1-bootstrap-monorepo`
2. `codex/phase1-cli-init-skeleton`
3. `codex/phase1-service-foundation`
4. `codex/phase1-forgejo-integration`
5. `codex/phase1-grants-viewer`
6. `codex/phase1-dashboard-logs-settings`

## Core Principles

- Myst runs beside Forgejo and talks to it only through the Forgejo API.
- Share links pin to an immutable `commit_sha`, not a moving branch.
- Myst keeps the admin surface private through operator-managed network or reverse-proxy protection.
- Myst does not provide built-in admin authentication in Phase 1; VPN, Tailscale, Cloudflare Access, or reverse-proxy auth is required for the admin surface.
- Forgejo access is performed by a constrained service account with minimum PAT scopes.
- A repo is shareable only if the service account can see it and Myst has sharing enabled for it.

## Forgejo Integration Requirements

- A Forgejo "service account" for Myst is a normal Forgejo user created by the operator, such as `myst-bot`.
- The operator creates the PAT for that user and grants repo access explicitly.
- Recommended PAT scopes are `read:user` and `read:repository`.
- Some organization or team-based setups may also require `read:organization`.
- Myst validates the account and token; it does not create Forgejo users, PATs, or repo permissions.

Helpful Forgejo docs:

- API usage: `https://forgejo.org/docs/latest/user/api-usage/`
- Token scopes: `https://forgejo.org/docs/latest/user/token-scope/`
- Repo permissions: `https://forgejo.org/docs/latest/user/repo-permissions/`
- Admin CLI: `https://forgejo.org/docs/latest/admin/command-line/`

## Planned CLI Surface

```bash
pnpm --filter @myst/cli build
node packages/cli/dist/index.js init
node packages/cli/dist/index.js forgejo bootstrap
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js config print
```

The CLI is intended to wire Myst into an existing Forgejo deployment. It should not provision Forgejo, Postgres, TLS, or reverse proxies for operators.

- `myst init` generates the Myst-owned configuration files needed for deployment, including `.env` and `myst.config.json`.
- `myst forgejo bootstrap` verifies Forgejo reachability, service-account identity, token scopes, and read access to the repo data Myst needs.

The Phase 1 pull requests are intentionally stacked so each review focuses on one layer of the system at a time.
