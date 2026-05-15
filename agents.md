# agents.md

This file is the single source of truth for codebase obstacles, oddities, and their resolutions. Do not scatter this knowledge in comments, commit messages, or memory.

---

## Rules for agents

1. **Before solving a problem**, check this file. If the problem is documented, use the recorded solution or workaround. Do not re-derive it.
2. **After solving a new problem**, document it here before moving on. Keep entries concise.
3. **Do not deviate** from a recorded solution without first confirming with the user. Once confirmed, update this file with the new approach and reason before proceeding.

---

## Entry format

```text
### [Short problem title]
**Area:** [file, module, or system this affects]
**Obstacle:** What the problem is and where it appears.
**Solution/Workaround:** What was done to fix or work around it.
**Preference:** If multiple approaches exist, which was chosen and why.
```

---

## Documented obstacles

### TypeScript composite builds fail with no output
**Area:** packages/cli/tsconfig.json, tsconfig.base.json
**Obstacle:** When `composite: true` is set in tsconfig, TypeScript requires proper project references to build. The CLI package was building but producing no output files, causing "cannot find module" errors.
**Solution:** Remove `composite: true` from packages/cli/tsconfig.json. Also removed `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` from tsconfig.base.json as they caused strict type issues with dynamic config objects.
**Preference:** Use simple tsconfig without composite mode for CLI package.

### verify.ts overly complex abstraction
**Area:** packages/cli/src/commands/verify.ts
**Obstacle:** Code had too many layers: collectResults → addResult (inner function) → displayDiagnosticResults/verifyResults. Made it hard to trace and debug.
**Solution:** Rewrote to be flatter: verifyCommand → runDiagnosticMode/runVerifyMode. Used simple inline logic instead of adding functions for everything.
**Preference:** KISS - keep functions small but avoid over-abstraction.

### Error messages in forgejo-checks too generic
**Area:** packages/cli/src/utils/forgejo-checks.ts
**Obstacle:** Network errors showed "fetch failed" with no context. HTTP errors showed just status codes. Not actionable for users.
**Solution:** Added getErrorMessage() helper to detect: timeouts, connection refused, host not found. Improved HTTP error messages to include status text. Added context prefixes like "cannot reach server", "cannot connect to API".
**Preference:** Actionable messages that tell users what to fix.

### ENV_MAPPING duplicated inline in verify.ts
**Area:** packages/cli/src/commands/verify.ts
**Obstacle:** Had duplicate object with same keys as ENV_MAPPING from config.ts. Two sources of truth.
**Solution:** Import ENV_MAPPING and use it. Change display to show env var names (SNAKE_CASE) instead of internal keys.
**Preference:** Single source of truth in config.ts.

### Display verbiage redundancy
**Area:** packages/cli/src/commands/verify.ts
**Obstacle:** Displayed "MYST_PUBLIC_URL set" - "set" is redundant, icon already shows status.
**Solution:** Just show env var name, remove "set". Shows "MYST_PUBLIC_URL configured" or "MYST_PUBLIC_URL missing".
**Preference:** Cleaner, let icon indicate status.

### loadConfig returning wrong type for error case
**Area:** packages/cli/src/commands/verify.ts  
**Obstacle:** loadConfig() threw error when .env not found, but caught and re-threw in verifyCommand. This caused process to exit with stack trace instead of clean message.
**Solution:** Return null on ENOENT, handle null in verifyCommand. Return type: `Record<string, string> | null`.
**Preference:** Explicit null handling over exceptions for user-facing errors.

### process.exit(0) prevents finally blocks
**Area:** CLI commands using process.exit()
**Obstacle:** process.exit(0) stops execution immediately, never runs cleanup code.
**Solution:** Use process.exitCode = 1 and return instead of process.exit().
**Preference:** Set exitCode and return to allow cleanup.

### Logout cookie not reaching browser
**Area:** web/app/routers/auth.py, web/app/auth/session.py
**Obstacle:** `revoke_session` set cookies on the injected `Response` parameter, but the logout handler returned a new `RedirectResponse` — so `Set-Cookie` was discarded.
**Solution:** Create `RedirectResponse` first, then pass it into `revoke_session`. Same pattern used in `callback_forgejo` for `create_session`.
**Preference:** Pass the actual response object that will be returned.

### Dashboard leaking ORM session object
**Area:** web/app/main.py
**Obstacle:** `/dashboard` returned the full ORM `Session` object (`sess`), leaking `token_hash`, `revoked_at`, etc. to the client.
**Solution:** Return a plain dict with only safe fields: `user_id`, `display_name`, `email`, `session_id`, `created_at`.
**Preference:** Never return ORM objects directly in API responses.

### crypto.py decrypt functions kept proactively
**Area:** web/app/auth/crypto.py
**Obstacle:** CodeRabbit flagged missing decryption functions and key validation. Added `decrypt_oauth_token`/`decrypt_optional` + key format validation in `fernet_from_encryption_key`.
**Solution:** Added the functions even though no consumer exists yet. They will be used for PAT decryption in share link flow.
**Preference:** Keep dead code if it's small, symmetric (`encrypt`/`decrypt`), and has an obvious future consumer.

### User model Session import direct instead of TYPE_CHECKING
**Area:** web/app/models/user.py
**Obstacle:** `Session` was imported directly (`from .session import Session`) while `Grant` used `TYPE_CHECKING`. Inconsistent and risked circular imports.
**Solution:** Moved `Session` import under `TYPE_CHECKING`, changed relationship to string ref `"Session"`.
**Preference:** Always use `TYPE_CHECKING` for model references within models to avoid circular imports.