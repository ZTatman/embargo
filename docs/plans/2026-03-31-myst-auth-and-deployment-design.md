# Myst Auth and Deployment Design

This document captures current decisions about deployment topology and CLI scope for Phase 1.

## Goals

- Keep Myst self-hosted and private by default.
- Let operators attach Myst to an existing Forgejo deployment.
- Expose only the read-only share-link viewer and Myst UI routes the operator chooses to publish.
- Make the CLI responsible for Myst-specific configuration, validation, and Forgejo integration checks.
- Keep Phase 1 scope minimal and shippable.

## Non-Goals

- Built-in admin authentication in Myst for Phase 1.
- Provisioning Forgejo for operators.
- Provisioning PostgreSQL for Forgejo or Myst.
- Owning reverse proxy, DNS, TLS, backup, or firewall setup.
- Replacing Coolify or any other hosting platform.
- Adding a SaaS control plane.
- Requiring end users to join Tailscale in order to view shared code.
- Designing a browser-based admin UX before the backend and integration flow exist.

## Core Architecture

Myst is a companion service deployed beside an existing Forgejo instance. It owns its own UI/API app and its own database, and it integrates with Forgejo only through the Forgejo API.

```ascii
                   Public Internet
                         |
                         v
                 DNS: myst.example.com
                         |
                         v
              Reverse Proxy / Platform Router
                (Coolify, Caddy, Nginx, etc.)
                         |
                         v
                Myst App (UI + API)
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
- Myst authenticates to Forgejo with an operator-created service account token.
- Myst admin access is protected upstream rather than by an in-app login system in Phase 1.
- VPN, Tailscale, Cloudflare Access, or reverse-proxy auth is required for the admin surface in Phase 1.

## Deployment

Myst should be deployable anywhere an operator can run a normal web app and Postgres database.

Recommended v1 deployment environments:

1. Same VPS or host as Forgejo
2. Same Coolify project or private network as Forgejo
3. Separate host on the same trusted network as Forgejo

Admin access security is the operator's responsibility (VPN, firewall rules, SSO, host access, etc). Myst does not enforce or scaffold this in Phase 1.

Recommended admin protection modes:

1. Tailscale or another private network
2. Cloudflare Access or similar identity-aware proxy
3. Reverse-proxy basic auth or IP allowlisting when the operator accepts the trade-offs

Recommended hostname split:

- `https://share.example.com` for the public viewer
- `https://admin.example.com` for the private admin UI

## Public Viewer Rules

- Share links are public resources by design.
- Public access must be read-only.
- Public access must not expose database ports or Forgejo admin surfaces.
- Viewer requests must validate:
  - link token
  - expiration
  - revoked state
  - snapshot binding

The viewer should be the only public application surface that emits code content.

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
- optional platform templates for Myst only

## Data and Auth Model

- Share links are tied to immutable snapshots.
- Grants must resolve to a specific `commit_sha`.
- Viewer endpoints must never accept arbitrary repo/ref selection.
- Myst stores its metadata in its own Postgres database.
- Minimum v1 data model is `repos` and `grants`.
- Operators create the Forgejo service account and PAT themselves.
- Myst does not maintain a separate in-app admin user database in Phase 1.
- Admin access is delegated to operator-managed network or reverse-proxy controls.

## Repo Implementation Impact

Active surfaces:

- CLI entrypoint: `packages/cli/src/index.ts`
- Command stubs: `packages/cli/src/commands/*`
- Config generators: `packages/cli/src/generators/*`
- Shared constants/types: `packages/shared/src/*`
- Service entrypoint: `packages/service/src/index.ts`

Next implementation work:

1. Narrow `init` to Myst-only config generation for an existing Forgejo deployment
2. Add config types for Forgejo connection details, Myst base URL, and database settings
3. Implement `forgejo bootstrap` and `doctor`
4. Add Postgres-backed service foundation using the minimum `repos` and `grants` schema
5. Wire the service to load generated config and validate required env at startup

## Open Questions

- Should the public viewer be mounted at a fixed path like `/share/*` or a dedicated hostname?
- Should the admin UI and viewer share a single Myst origin in v1, or should the docs recommend separate admin and public origins?
