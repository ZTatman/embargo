# Myst UI Design

## Purpose

Web application for creating secure, time-limited, view-only links to self-hosted Forgejo repositories. Users share specific commits as read-only web views with expiration dates.

## Pages

### Landing Page (`GET /`)
- Explains Myst
- "Sign in with Forgejo" button
- Nav shows Sign in (anonymous) or Dashboard/Logout (authenticated)

### Dashboard (`GET /dashboard`, auth required)
- Welcome message with user display name
- **Display name editor** — inline edit
- **Default expiration** — dropdown/number input for new links (e.g., 1 day, 7 days, 30 days)
- **PAT registration** — text input to register `read:repository,read:user`-scoped PAT
- **Links list** — table of created share links with status (active/expired/revoked), view count, last viewed, and a revoke button
- **Audit log** — expandable per-link logs showing viewer IP, country, user agent, and timestamp

### Links List (seperate page)
- Paginated list of all share links created by the user
- Search/filter by repo name, status, expiration date
- Link status: active, expired, revoked
- Click a link to view details and audit log

### Create Link (modal or inline form on dashboard)
- Repo owner, repo name, branch, commit SHA
- Expiration date
- Public/private toggle
- Optional recipient email (for private links)

### Share Link View (`/links/<id>`)
- Read-only file tree viewer at the pinned commit
- Gated by auth if the link is private
- Public links are open to anyone
- Tracked: log viewer IP, country, user agent, timestamp

## Infrastructure

- **Stack:** FastAPI + Jinja2 + HTMX + Pico CSS (jade theme)
- **Auth:** Forgejo OAuth with cookie-based sessions (existing)
- **Templates:** Jinja2 blocks via `jinja2-fragments` for HTMX partials
- **No build step** — all CSS/JS from CDN
- **Database models needed:**
  - `Link` — supersedes current `Grant` model (or extends it)
  - `LinkView` — audit log entries (link_id, ip, country, user_agent, viewed_at)
  - `UserSettings` — display_name, default_expiration_days, geo_block_list (optional)
  - `ViewerSession` — for private link viewer auth (separate from user sessions)

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | optional | Landing page |
| GET | `/dashboard` | required | Dashboard |
| GET/PUT | `/settings` | required | Update display name, default expiration, geo-blocking settings, PAT, theme |
| POST | `/dashboard/pat` | required | Register PAT |
| GET | `/links/create` | required | Create link form |
| GET | `/links` | required | List user's links |
| POST | `/links` | required | Create link |
| GET | `/links/{id}` | public/private | View shared repo |
| POST | `/links/{id}/revoke` | required | Revoke a link |
| GET | `/links/{id}/audit` | required | Audit log for a link |

## Data Flow

1. User signs in with Forgejo OAuth → session cookie created
2. User registers PAT → encrypted and stored on their account
3. User creates share link → pin a repo + commit → stored as Link record
4. Viewer visits `/links/{id}`:
   - If public → render view immediately, log the visit
   - If private → require viewer auth (future), log the visit
   - If expired or revoked → show "link unavailable"
5. Revoke sets `revoked_at` on the Link
6. Audit log shows all `LinkView` entries for the link

## Future Considerations

- Per-link geo-blocking
- Email notification when a link is viewed
- Viewer authentication for private links (simple email + magic link)
- Expiration countdown timer on the share link view page
- Option to extend expiration from the dashboard
- anti-bot measures for public links (e.g., rate limiting, CAPTCHA)
- ctrl+copy disable on the share link view page to prevent easy copying of content (optional)
- ability to pin a branch instead of a specific commit, with the view always showing the latest commit on that branch (optional)
- ability to create a portfolio page showing multiple pinned repos/links in a grid (optional) with a custom URL (e.g., `/users/{username}/portfolio`) user can share instead of individual links
- Watermarking the share link view with the viewer's IP address and timestamp to discourage screenshots (optional)
- Disable screenshotting on the share link view page using CSS (e.g., `-webkit-user-select: none;`, `pointer-events: none;`) (optional)
- Disable command hot keys inspect open dev tools on the share link view page (optional)