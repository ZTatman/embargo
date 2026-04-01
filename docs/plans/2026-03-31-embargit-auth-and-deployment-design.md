# EmbarGit Auth and Deployment Design

This document captures current decisions about deployment topology and CLI scope for Phase 1.

## Goals

- Keep EmbarGit self-hosted and private by default.
- Expose only the read-only share-link viewer to the public internet.
- Make the CLI responsible for generating deployment files and setup scaffolding.
- Keep Phase 1 scope minimal and shippable.

## Non-Goals

- Any admin authentication layer (no Tailscale, no Pocket ID, no login screen).
- Reverse proxy generation or examples.
- Cloudflare integration or documentation.
- Replacing Forgejo.
- Adding a SaaS control plane.
- Requiring end users to join Tailscale in order to view shared code.
- Designing a browser-based admin UX before the backend and deployment scaffolding exist.

## Core Architecture

EmbarGit has two distinct surfaces:

- Public viewer surface for read-only share links.
- Private admin and operational surface for owners/operators.

The security boundary is the public/private split, not an auth layer.

```ascii
Public internet
    |
    v
Read-only viewer endpoint
    |
    +--> Embargo/EmbarGit app
    |
    +--> Private Forgejo API
    |
    +--> Private database

Admin/operator access
    |
    v
Direct host or VPN (operator's responsibility)
    |
    v
Private admin panel
    |
    +--> Forgejo admin
    +--> Postgres
    +--> Logs / backups / host access
```

## Deployment

Single deployment mode: Docker Compose.

- EmbarGit service
- Forgejo service
- PostgreSQL service
- Network definitions for private/public separation

Admin access security is the operator's responsibility (VPN, firewall rules, etc). EmbarGit does not enforce or scaffold this in Phase 1.

## Public Viewer Rules

- Share links are public resources by design.
- Public access must be read-only.
- Public access must not expose admin routes, database ports, or Forgejo admin surfaces.
- Viewer requests must validate:
  - link token
  - expiration
  - revoked state
  - snapshot binding

The viewer should be the only public application surface that emits code content.

## CLI Responsibilities

The CLI is the primary way to scaffold a deployment.

### `init`

`init` should:

- prompt for domain / hostnames
- generate `.env`
- generate `docker-compose.yml`
- generate Forgejo and Embargo service defaults

### `start`, `stop`, `status`

Thin wrappers around Docker Compose.

### CLI UX

- Use spinners for long-running steps.
- Use prompts for interactive configuration.
- Keep output terse and actionable.
- Present generated files clearly after initialization.

## Configuration Outputs

Expected outputs from `init`:

- `.env`
- `docker-compose.yml`

## Data and Auth Model

- Share links are tied to immutable snapshots.
- Grants must resolve to a specific `commit_sha`.
- Viewer endpoints must never accept arbitrary repo/ref selection.

## Repo Implementation Impact

Active surfaces:

- CLI entrypoint: `packages/cli/src/index.ts`
- Command stubs: `packages/cli/src/commands/*`
- Config generators: `packages/cli/src/generators/*`
- Shared constants/types: `packages/shared/src/*`
- Service entrypoint: `packages/service/src/index.ts`

Next implementation work:

1. Make `init` generate configs via interactive prompts
2. Add a CLI prompt/spinner library
3. Expand shared types for deployment config
4. Wire the service to use the generated config

## Open Questions

- Should the public viewer be mounted at a fixed path like `/share/*` or a dedicated hostname?
