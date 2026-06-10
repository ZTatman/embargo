from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from starlette.responses import Response

from app.auth import tokens
from app.auth.session import get_current_session
from app.config import get_app_settings
from app.models.app_settings import AppSettings
from app.models.session import Session as UserBrowserSession
from app.services import forgejo
from app.templating import templates

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> Response:
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {"user": sess.user},
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
                    "/api/v1/user/repos",
                    token=pat,
                    params={"limit": 50, "sort": "updated"},
                    timeout=10.0,
                )
                repositories = [r for r in repos if r.get("permissions", {}).get("pull", True)]
                # Defend against a hostile/MITM'd Forgejo returning a
                # javascript: (or other non-http) URL we'd render into href.
                for r in repositories:
                    url = r.get("html_url")
                    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                        r["html_url"] = ""
            except forgejo.ForgejoError as exc:
                repo_error = (
                    "Could not reach your Forgejo instance."
                    if exc.unreachable
                    else "Could not fetch repositories from Forgejo."
                )

    return templates.TemplateResponse(
        request,
        "partials/dashboard_repositories.html",
        {"repositories": repositories, "repo_error": repo_error},
    )
