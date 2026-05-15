from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.identity import find_or_create_user
from app.auth.session import create_session, revoke_session
from app.config import Settings, get_settings
from app.deps import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Forgejo API client ──


async def _forgejo_post(settings: Settings, path: str, data: dict) -> dict:
    url = f"{settings.forgejo_base_url.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, data=data, headers={"Accept": "application/json"})
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach Forgejo: {exc}",
        ) from exc
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(f"Forgejo API error {resp.status_code} at {path}: {resp.text[:500]}"),
        )
    return resp.json()


async def _forgejo_get(settings: Settings, path: str, token: str) -> dict:
    url = f"{settings.forgejo_base_url.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers={"Authorization": f"token {token}"})
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach Forgejo: {exc}",
        ) from exc
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(f"Forgejo API error {resp.status_code} at {path}: {resp.text[:500]}"),
        )
    return resp.json()


# ── OAuth CSRF helpers ──


def _set_oauth_state_cookie(response: Response, state: str) -> None:
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=600,
    )


def _verify_oauth_state(state: str | None, oauth_state: str | None) -> None:
    if not state or not oauth_state or not secrets.compare_digest(state, oauth_state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state mismatch. Possible CSRF attack.",
        )


# ── Forgejo response parsers ──


def _parse_token_response(data: dict) -> tuple[str, str | None, datetime | None]:
    access_token = data.get("access_token")
    if not access_token or not isinstance(access_token, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Forgejo OAuth response did not include an access_token.",
        )
    refresh_token = data.get("refresh_token")
    refresh_plain = refresh_token if isinstance(refresh_token, str) else None
    expires_in = data.get("expires_in")
    if expires_in is not None:
        expires_at = datetime.now(UTC) + timedelta(seconds=int(expires_in))
    else:
        expires_at = None
    return access_token, refresh_plain, expires_at


def _parse_user_response(data: dict) -> tuple[str, str, str | None]:
    provider_user_id = str(data.get("id", "")).strip()
    provider_username = str(data.get("login", "")).strip()
    if not provider_user_id or not provider_username:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Forgejo user response missing id or login.",
        )
    email_val = data.get("email")
    email = email_val if isinstance(email_val, str) and email_val.strip() else None
    return provider_user_id, provider_username, email


# ── OAuth config helpers ──


def _forgejo_oauth_redirect_uri(request: Request, settings: Settings) -> str:
    base_url = settings.myst_public_base_url.strip().rstrip("/")
    if base_url:
        return f"{base_url}/auth/callback/forgejo"
    return str(request.url_for("forgejo_oauth_callback"))


def _require_forgejo_oauth_config(settings: Settings) -> None:
    if not settings.forgejo_base_url.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forgejo is not configured: set FORGEJO_BASE_URL in the environment.",
        )
    if not settings.forgejo_oauth_client_id.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forgejo OAuth is not configured: set FORGEJO_OAUTH_CLIENT_ID in the environment.",
        )
    secret = settings.forgejo_oauth_client_secret.get_secret_value().strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forgejo OAuth is not configured: set FORGEJO_OAUTH_CLIENT_SECRET in the environment.",
        )


# ── Routes ──


@router.get("/login/forgejo")
async def login_forgejo(
    request: Request, settings: Settings = Depends(get_settings)
) -> RedirectResponse:
    _require_forgejo_oauth_config(settings)

    redirect_uri = _forgejo_oauth_redirect_uri(request, settings)
    state = secrets.token_urlsafe(32)
    query = urlencode(
        {
            "client_id": settings.forgejo_oauth_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    authorization_url = f"{settings.forgejo_base_url.rstrip('/')}/login/oauth/authorize?{query}"
    response = RedirectResponse(authorization_url, status_code=status.HTTP_302_FOUND)
    _set_oauth_state_cookie(response, state)
    return response


@router.get("/callback/forgejo", name="forgejo_oauth_callback")
async def callback_forgejo(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    code: str | None = None,
    state: str | None = None,
    oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    _require_forgejo_oauth_config(settings)
    _verify_oauth_state(state, oauth_state)

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forgejo did not return an authorization code. The user may have denied consent.",
        )

    redirect = RedirectResponse("/dashboard", status_code=status.HTTP_302_FOUND)
    redirect.delete_cookie("oauth_state")

    token_data = await _forgejo_post(
        settings,
        "/login/oauth/access_token",
        {
            "grant_type": "authorization_code",
            "client_id": settings.forgejo_oauth_client_id,
            "client_secret": settings.forgejo_oauth_client_secret.get_secret_value(),
            "code": code,
            "redirect_uri": _forgejo_oauth_redirect_uri(request, settings),
        },
    )
    access_token, refresh_plain, expires_at = _parse_token_response(token_data)

    user_data = await _forgejo_get(settings, "/api/v1/user", access_token)
    provider_user_id, provider_username, email = _parse_user_response(user_data)

    user = await find_or_create_user(
        db,
        settings,
        provider="forgejo",
        provider_user_id=provider_user_id,
        provider_username=provider_username,
        email=email,
        access_token_raw=access_token,
        access_token_expires_at=expires_at,
        refresh_token_raw=refresh_plain,
    )

    await create_session(db, redirect, user.id, secure=request.url.scheme == "https")
    return redirect


@router.get("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    myst_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    redirect = RedirectResponse("/", status_code=status.HTTP_302_FOUND)
    await revoke_session(db, redirect, myst_session)
    return redirect
