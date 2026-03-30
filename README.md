# Embargo

Your code, under embargo.

Embargo is a companion service for Forgejo that lets repo owners create expiring, revocable, read-only share links for private code snapshots.

## Phase 1 PR Breakdown

Phase 1 is split into these reviewable branches:

1. `codex/phase1-bootstrap-monorepo`
2. `codex/phase1-cli-init-skeleton`
3. `codex/phase1-service-foundation`
4. `codex/phase1-forgejo-integration`
5. `codex/phase1-grants-viewer`
6. `codex/phase1-dashboard-logs-settings`

## Core Principles

- Embargo runs beside Forgejo and talks to it only through the Forgejo API.
- Share links pin to an immutable `commit_sha`, not a moving branch.
- Embargo uses its own owner auth for MVP.
- Forgejo access is performed by a constrained service account with minimum PAT scopes.
- A repo is shareable only if the service account can see it and Embargo has sharing enabled for it.

