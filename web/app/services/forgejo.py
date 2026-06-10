"""Thin async client for the Forgejo API.

Centralizes the httpx mechanics, base-URL joining, and error shape shared by
the OAuth flow (`app.routers.auth`) and the dashboard repository fragment
(`app.main`). Transport failures and non-2xx responses both surface as a typed
`ForgejoError`, leaving each caller free to decide how to handle them — the
OAuth routes translate it into an HTTP 502, while the dashboard renders an
inline message.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode

import httpx

if TYPE_CHECKING:
    from app.models.app_settings import AppSettings

DEFAULT_TIMEOUT = 30.0


class ForgejoError(Exception):
    """A Forgejo API call failed — either unreachable or a non-2xx response."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        # The HTTP status returned by Forgejo, or None if it was unreachable.
        self.status_code = status_code

    @property
    def unreachable(self) -> bool:
        """True when the request never got an HTTP response (network error)."""
        return self.status_code is None


def _url(app_settings: AppSettings, path: str) -> str:
    # Defensive rstrip: a base URL stored with a trailing slash would otherwise
    # produce a double slash (`https://forge//api/...`) and 404.
    return f"{app_settings.forgejo_base_url.rstrip('/')}{path}"


async def get(
    app_settings: AppSettings,
    path: str,
    *,
    token: str | None = None,
    params: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    """GET a Forgejo API path, returning parsed JSON. Raises ForgejoError."""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"token {token}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(_url(app_settings, path), params=params, headers=headers)
    except httpx.RequestError as exc:
        raise ForgejoError("Cannot reach Forgejo. Check your connection settings.") from exc
    if resp.status_code != 200:
        raise ForgejoError(
            f"Forgejo returned an error ({resp.status_code}).",
            status_code=resp.status_code,
        )
    return resp.json()


async def post(
    app_settings: AppSettings,
    path: str,
    data: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    """POST form data to a Forgejo API path, returning parsed JSON. Raises ForgejoError."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                _url(app_settings, path), data=data, headers={"Accept": "application/json"}
            )
    except httpx.RequestError as exc:
        raise ForgejoError("Cannot reach Forgejo. Check your connection settings.") from exc
    if resp.status_code != 200:
        raise ForgejoError(
            f"Forgejo returned an error ({resp.status_code}).",
            status_code=resp.status_code,
        )
    return resp.json()


# ── OAuth ──


def authorize_url(app_settings: AppSettings, *, redirect_uri: str, state: str) -> str:
    """Build the Forgejo OAuth authorize URL to redirect the browser to."""
    query = urlencode(
        {
            "client_id": app_settings.forgejo_oauth_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    return f"{_url(app_settings, '/login/oauth/authorize')}?{query}"


async def exchange_code(
    app_settings: AppSettings,
    *,
    code: str,
    client_secret: str,
    redirect_uri: str,
) -> Any:
    """Exchange an authorization code for tokens. Raises ForgejoError."""
    return await post(
        app_settings,
        "/login/oauth/access_token",
        {
            "grant_type": "authorization_code",
            "client_id": app_settings.forgejo_oauth_client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        },
    )


async def fetch_user(app_settings: AppSettings, token: str) -> Any:
    """Fetch the authenticated user's Forgejo profile. Raises ForgejoError."""
    return await get(app_settings, "/api/v1/user", token=token)
