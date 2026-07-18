from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func as sql_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.auth import tokens
from app.auth.session import get_current_session
from app.config import get_app_settings
from app.deps import get_db
from app.models.app_settings import AppSettings
from app.models.grant import Grant
from app.models.session import Session as UserBrowserSession
from app.services import forgejo
from app.templating import templates

router = APIRouter(tags=["dashboard"])


def _repository_error_message(exc: forgejo.ForgejoError) -> str:
    if exc.unreachable:
        return "Could not reach your Forgejo instance."
    if exc.status_code == 401:
        return "Forgejo rejected the access token. Register a valid read:repository token."
    if exc.status_code == 403:
        return "Forgejo denied repository access. Check that the token has read:repository scope."
    if exc.status_code == 404:
        return "Forgejo did not find the repository API. Check the configured Forgejo base URL."
    return exc.message


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> Response:
    # Live exposure summary for the header strip: how many share links are
    # active right now, and when the next one expires.
    now = datetime.now(UTC)
    active_filter = (
        Grant.user_id == sess.user.id,
        Grant.revoked_at.is_(None),
        Grant.expires_at > now,
    )
    row = (
        await db.execute(
            select(sql_func.count(), sql_func.min(Grant.expires_at)).where(*active_filter)
        )
    ).one()
    exposure = {"active": row[0], "next_expiry": row[1]}

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {"user": sess.user, "exposure": exposure},
    )


@router.get("/dashboard/repositories", response_class=HTMLResponse)
async def dashboard_repositories(
    request: Request,
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
    app_settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> Response:
    """Lazy-loaded fragment: fetch the user's Forgejo repositories.

    The dashboard pulls this in via htmx after first paint, so a slow or
    unreachable Forgejo instance never blocks the page from rendering.
    """
    repositories: list[dict] = []
    repo_error: str | None = None

    if sess.user.has_pat:
        pat = tokens.decrypt_pat(sess.user)
        if pat:
            try:
                repos = await forgejo.get(
                    app_settings,
                    "/api/v1/repos/search",
                    token=pat,
                    params={"limit": 50, "sort": "updated", "order": "desc"},
                    timeout=10.0,
                )
                repos = repos.get("data", []) if isinstance(repos, dict) else repos
                repositories = [r for r in repos if r.get("permissions", {}).get("pull", True)]
                # Defend against a hostile/MITM'd Forgejo returning a
                # javascript: (or other non-http) URL we'd render into href.
                for r in repositories:
                    url = r.get("html_url")
                    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                        r["html_url"] = ""
            except forgejo.ForgejoError as exc:
                repo_error = _repository_error_message(exc)

    return templates.TemplateResponse(
        request,
        "partials/dashboard_repositories.html",
        {"repositories": repositories, "repo_error": repo_error},
    )
