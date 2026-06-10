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
**Obstacle:** CodeRabbit flagged missing decryption functions and key validation. Added `decrypt_token`/`decrypt_optional` + key format validation in `fernet_from_encryption_key`.
**Solution:** Added the functions even though no consumer exists yet. They will be used for PAT decryption in share link flow.
**Preference:** Keep dead code if it's small, symmetric (`encrypt`/`decrypt`), and has an obvious future consumer.

### User model Session import direct instead of TYPE_CHECKING
**Area:** web/app/models/user.py
**Obstacle:** `Session` was imported directly (`from .session import Session`) while `Grant` used `TYPE_CHECKING`. Inconsistent and risked circular imports.
**Solution:** Moved `Session` import under `TYPE_CHECKING`, changed relationship to string ref `"Session"`.
**Preference:** Always use `TYPE_CHECKING` for model references within models to avoid circular imports.

### Boilerplate UI must follow attached light vault system
**Area:** web/app/static/css/input.css, web/app/templates/*.html
**Obstacle:** Existing boilerplate used dark-mode pink tokens that conflicted with the attached "Mystique Minimalist Security" design system.
**Solution/Workaround:** Use light Geist/JetBrains Mono typography, glacier-blue primary actions, white/off-white tonal surfaces, hairline slate borders, compact labels, mono technical strings, and pill status badges.
**Preference:** Keep visual changes in Tailwind tokens and boilerplate templates; avoid backend route changes for design-only updates.

### Tailwind design tokens should use paired semantic roles
**Area:** web/app/static/css/input.css, web/app/templates/*.html
**Obstacle:** Early UI templates mixed old role names (`background-*`, `text-*`, `stroke`) and hardcoded `white` values inside component classes, which made dark mode and future theming brittle.
**Solution/Workaround:** Use Tailwind v4 `@theme` tokens with semantic pairs such as `background/foreground`, `card/card-foreground`, `primary/primary-foreground`, `secondary/secondary-foreground`, `border`, `input`, and `ring`. Keep shared component structure in base classes like `.btn`, with variant classes only setting semantic colors.
**Preference:** Prefer semantic token names over appearance-based names; add dark mode by overriding CSS variables under `.dark`.

### Dark-only Tailwind tokens live at root
**Area:** web/app/static/css/input.css, web/app/templates/*.html
**Obstacle:** The Firebreak UI is currently dark-only, but stale light theme tokens and scattered literal palette values made the active design system harder to change safely.
**Solution/Workaround:** Define Firebreak brand primitives and dark semantic roles in the root Tailwind v4 `@theme`; templates and component classes use token-backed utilities/classes instead of raw theme colors.
**Preference:** Keep palette values centralized in `@theme`; avoid arbitrary color utilities in templates. Reintroduce light mode only after defining a full paired token set.

### Button hover states belong to variants
**Area:** web/app/static/css/input.css, web/app/templates/*.html
**Obstacle:** Buttons mixed shared variants with page-specific hover utilities and ID selectors, causing inconsistent hover colors across pages.
**Solution/Workaround:** Add explicit variants such as `btn-danger` and `btn-link`; templates should choose the correct variant instead of stacking custom hover color utilities.
**Preference:** Keep hover behavior in component variants. Use `btn-link` for low-emphasis navigation actions such as returning home from an error page.

### Vercel web guideline fixes should stay template-scoped
**Area:** web/app/templates/*.html, web/app/static/css/input.css
**Obstacle:** Vercel Web Interface Guidelines flagged accessibility/theming issues such as missing skip links, missing dark `color-scheme`, non-locale date formatting, form inputs without autocomplete metadata, and motion without reduced-motion handling.
**Solution/Workaround:** Add global `color-scheme: dark`, keep form metadata in templates, format visible dates with `Intl.DateTimeFormat`, confirm destructive forms client-side, and provide `prefers-reduced-motion` CSS fallbacks.
**Preference:** Prefer lightweight template/CSS fixes for UI guideline compliance; avoid backend route changes unless the issue requires server state.

### Header brand SVG inherits unwanted icon styling
**Area:** web/app/templates/base.html, web/app/templates/index.html, web/app/static/css/input.css
**Obstacle:** The inline Firebreak header wordmark uses hardcoded SVG fills, and page-level header rules can accidentally apply icon `stroke` styles to the brand SVG. On forced-dark landing headers, the `#17191C` wordmark fill disappears against the obsidian nav.
**Solution/Workaround:** Give the header brand link a stable `brand-link` class, prevent inherited SVG strokes on `.brand-link svg`, and override only the hardcoded wordmark fill in dark contexts or forced-dark page headers.
**Preference:** Scope icon stroke rules to nav icons; do not apply broad `header svg` stroke styles.

### Landing video poster caused logo flash
**Area:** web/app/templates/index.html, web/app/static/img/
**Obstacle:** Using a logo SVG as the `<video poster>` made the browser briefly stretch the logo across the full hero video area before the MP4 painted, which looked like the center logo flashing huge on refresh.
**Solution/Workaround:** Use a real video-frame poster image (`firebreak-hero-poster.jpg`) or omit `poster`; do not use logo assets as full-bleed video posters.
**Preference:** Keep logo sizing in the logo `<img>` and use a frame still for video loading states.

### POST forms lack CSRF tokens
**Area:** web/app/routers/setup.py, web/app/routers/settings.py, web/app/templates/setup.html, web/app/templates/settings.html
**Obstacle:** All state-changing forms (`/setup`, `/settings/pat`, `/settings/pat/delete`) use plain POST with no CSRF token. SameSite=Lax on the session cookie mitigates most cross-origin attacks, but does not fully cover same-site subdomain scenarios.
**Solution/Workaround:** Deferred. Low practical risk since Firebreak runs behind a VPN. Add server-generated CSRF tokens (hidden form field + server-side check) before exposing the app to the public internet.
**Preference:** Use a FastAPI CSRF middleware or manual double-submit cookie pattern when addressing this.

### Firebreak UI is currently dark-only
**Area:** web/app/templates/base.html, web/app/static/css/input.css
**Obstacle:** Theme switching and persisted localStorage theme state conflicted with the current Firebreak brand pass, especially on the cinematic landing page.
**Solution/Workaround:** Force the root document to use the `.dark` token set and remove the theme toggle UI/scripts.
**Preference:** Keep semantic dark tokens; only reintroduce theme switching after the dark Firebreak identity is stable.

### Landing hero styles belong in tokenized CSS
**Area:** web/app/templates/index.html, web/app/static/css/input.css
**Obstacle:** Inline hero gradients, shadows, and hardcoded OKLCH values made the landing page harder to tune without drifting away from the Firebreak design token system.
**Solution/Workaround:** Keep landing hero structure in `index.html`, but define overlays, logo effects, proof chips, and panel styling in `input.css` using hero-specific tokens.
**Preference:** Use semantic hero/component classes for cinematic landing styling; avoid inline `<style>` blocks and template-level color literals.

### Landing hero should avoid generic card and pill treatment
**Area:** web/app/templates/index.html, web/app/static/css/input.css
**Obstacle:** Bordered hero copy cards and pill-shaped proof badges made the cinematic landing page feel like generic SaaS UI instead of a Firebreak title card.
**Solution/Workaround:** Put hero copy directly over the video using tuned overlays, text shadow, a soft invisible copy scrim, a small burn-line accent, and bottom-anchored inline metadata separated by ember dots.
**Preference:** Preserve the video-led title-card feel; use red sparingly as an accent rather than wrapping hero content in panels or badges.

### Dashboard avoids card-heavy summary UI
**Area:** web/app/templates/dashboard.html, web/app/static/css/input.css
**Obstacle:** Dashboard summary metrics used repeated bordered cards and page-specific disabled button utilities, which made the UI feel generic and inconsistent with Firebreak's darker operational tone.
**Solution/Workaround:** Use a metric strip with hairline dividers, notice rails, tokenized table styles, and shared button disabled/hover variants.
**Preference:** Favor operational density, hairline separation, and semantic component classes over cards, pills, and one-off utility stacks.

### FastAPI drops `Depends` on params typed with TYPE_CHECKING-only forward refs
**Area:** web/app/config.py, any FastAPI dependency function
**Obstacle:** A dependency function (`get_app_settings`) had a parameter typed `Annotated[AppSettings | None, Depends(current_app_settings)]`, but `AppSettings` was imported only under `TYPE_CHECKING`. FastAPI introspects a dependency's signature at *runtime*; the unresolved forward ref made the annotation fail to evaluate, so FastAPI silently discarded the `Depends(...)` marker and treated `settings` as a **required query parameter**. Every gated route then 422'd demanding `?settings=...`. Route registration did not error — it only surfaced at request time.
**Solution/Workaround:** Required-settings dependency takes only `request: Request` and *calls* `current_app_settings(request)` internally (mirroring how `get_current_session` calls `lookup_session`), rather than declaring the accessor as a sub-`Depends` with a forward-ref-typed param.
**Preference:** Never give a FastAPI dependency/route a parameter whose type is a TYPE_CHECKING-only forward ref. Build required dependencies by *calling* the plain accessor, not by `Depends`-ing on it with a typed param. Verify dependency wiring by inspecting `route.dependant.query_params`, not by calling the function directly.

### Forgejo API access goes through app/services/forgejo.py
**Area:** web/app/services/forgejo.py, web/app/routers/auth.py, web/app/routers/dashboard.py
**Obstacle:** Forgejo HTTP calls (httpx client, base-URL joining, error handling) were duplicated across the OAuth flow and the dashboard, and a hand-built authorize URL re-introduced a trailing-slash double-slash hazard.
**Solution/Workaround:** All Forgejo HTTP goes through the `forgejo` service module: `get`/`post`, plus OAuth ops `authorize_url`/`exchange_code`/`fetch_user`. Base-URL joining is centralized in `_url()` with a defensive `rstrip('/')`. Failures raise a typed `ForgejoError` (with `.unreachable`); routers translate it — OAuth routes to HTTP 502, the dashboard to an inline message.
**Preference:** Add new Forgejo operations as `forgejo.*` functions; routers orchestrate (cookies, sessions, error mapping) but never build URLs or call httpx directly. Import the module (`from app.services import forgejo` → `forgejo.get(...)`), not individual functions.

### Credential encryption is centralized in app/auth/tokens.py
**Area:** web/app/auth/tokens.py, web/app/routers/settings.py, web/app/routers/setup.py, web/app/routers/auth.py
**Obstacle:** The `get_fernet()` + crypto-primitive + which-column pattern was scattered across routers and handlers, leaking the at-rest encryption detail into the web layer and duplicating it (e.g. the client-secret encrypt block appeared twice in setup.py).
**Solution/Workaround:** `app.auth.tokens` is the single app-aware layer pairing the app Fernet cipher with a model column: `decrypt_pat`/`set_pat` (PAT, keeps `pat_registered_at` in sync) and `set_client_secret`/`decrypt_client_secret`. It sits one level above `app.auth.crypto` (the primitives, which take a `fernet` and know nothing about the app).
**Preference:** Routers/handlers call `tokens.*`, never `get_fernet()` + crypto inline. Access-token encryption in `auth/identity.py` is intentionally left there — it is already cohesive in one domain function. Key rotation should be a one-file change in `tokens.py`/`crypto.py`.

### App settings exposed as required/optional FastAPI dependencies
**Area:** web/app/config.py, web/app/middleware.py, web/app/routers/setup.py
**Obstacle:** `app.state.app_settings` was read/written raw in many places, and the lone `get_app_settings` was typed `-> AppSettings` while actually returning `None` before setup — its non-None guarantee silently depended on `SetupRequiredMiddleware` having gated the route.
**Solution/Workaround:** Mirror the `session.py` trio: `current_app_settings(request) -> AppSettings | None` (honest accessor, used by middleware and setup), `get_app_settings(request) -> AppSettings` (required dependency; raises HTTP 500 if reached unconfigured), and `set_app_settings(app, row)` (single write path, used by lifespan and setup).
**Preference:** Routes that require config use `Depends(get_app_settings)`; None-tolerant readers (setup, middleware) use `current_app_settings`. Never read/write `app.state.app_settings` raw outside config.py.

### main.py is a composition root, not a route module
**Area:** web/app/main.py, web/app/errors.py, web/app/routers/dashboard.py, web/app/routers/dev.py
**Obstacle:** main.py held the lifespan, app wiring, the global exception handler, page route handlers, and a dev-only endpoint — feature logic mixed into the composition root, inconsistent with the per-feature router convention.
**Solution/Workaround:** Page routes live in `routers/dashboard.py`; the content-negotiated error handler in `errors.py` (wired via `register_error_handlers(app)`); dev-only endpoints in `routers/dev.py`, included only when `get_settings().debug`. main.py keeps lifespan + wiring + the trivial `/` landing route. An app factory (`create_app()`) is a deferred goal for when tests are added.
**Preference:** New feature routes get their own `routers/*.py`. Keep dev-only endpoints out of production by gating the `include_router` on the debug flag rather than guarding individual routes.

### Dashboard repositories load lazily; dev CSS reload is debug-gated
**Area:** web/app/routers/dashboard.py, web/app/templates/dashboard.html, web/app/templates/base.html
**Obstacle:** The dashboard blocked first paint on a live Forgejo fetch (up to 15s if the instance was slow/unreachable), and a dev CSS live-reload script polled an endpoint every 500ms in *all* environments, including production.
**Solution/Workaround:** `/dashboard` renders instantly; the repo list loads via an htmx fragment (`/dashboard/repositories` → `partials/dashboard_repositories.html`) after first paint, with a 10s timeout. The live-reload `<script>` and the `/api/dev/css-mtime` endpoint are both gated on the `debug` flag (a Jinja `debug` global + conditional `include_router`). Forgejo-supplied `html_url` is sanitized to drop non-`http(s)` schemes before rendering into an `href` (XSS guard).
**Preference:** Never block a page render on an external API; lazy-load via htmx. Keep dev tooling behind the debug flag. Treat external-API string fields as untrusted in templates.
