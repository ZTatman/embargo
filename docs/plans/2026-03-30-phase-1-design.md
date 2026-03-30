# Embargo Phase 1 Design

This document captures the approved Phase 1 plan for Embargo.

## Scope

Phase 1 delivers:

- CLI bootstrap for Forgejo + Embargo deployment
- Embargo service foundation
- constrained Forgejo service-account integration
- immutable snapshot grants pinned to `commit_sha`
- owner dashboard and viewer flow

## Reviewable Branches

1. `codex/phase1-bootstrap-monorepo`
2. `codex/phase1-cli-init-skeleton`
3. `codex/phase1-service-foundation`
4. `codex/phase1-forgejo-integration`
5. `codex/phase1-grants-viewer`
6. `codex/phase1-dashboard-logs-settings`

## Security Baseline

- service account access is restricted to approved repos
- Embargo grant checks are enforced on every Forgejo read
- grants store `repo_id` and pinned `commit_sha`
- viewer requests never choose repo or ref directly
