from __future__ import annotations

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


def _forgejo_oauth_redirect_uri(request: Request, settings: Settings) -> str:
    if settings.myst_public_base_url.strip():
        base = settings.myst_public_base_url.strip().rstrip("/")
        return f"{base}/auth/callback/forgejo"
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


@router.get("/login/forgejo")
async def login_forgejo(request: Request, settings: Settings = Depends(get_settings)) -> RedirectResponse:
    _require_forgejo_oauth_config(settings)
    redirect_uri = _forgejo_oauth_redirect_uri(request, settings)
    base = settings.forgejo_base_url.rstrip("/")
    query = urlencode(
        {
            "client_id": settings.forgejo_oauth_client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "read:user",
        }
    )
    authorize_url = f"{base}/login/oauth/authorize?{query}"
    return RedirectResponse(authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/callback/forgejo", name="forgejo_oauth_callback")
async def callback_forgejo(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    code: str | None = None,
) -> RedirectResponse:
    _require_forgejo_oauth_config(settings)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth authorization code from Forgejo.",
        )

    redirect_uri = _forgejo_oauth_redirect_uri(request, settings)
    base = settings.forgejo_base_url.rstrip("/")
    token_url = f"{base}/login/oauth/access_token"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_resp = await client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.forgejo_oauth_client_id,
                    "client_secret": settings.forgejo_oauth_client_secret.get_secret_value(),
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach Forgejo OAuth token endpoint: {exc}",
        ) from exc

    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Forgejo OAuth token exchange failed with HTTP {token_resp.status_code}: "
                f"{token_resp.text[:500]}"
            ),
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token or not isinstance(access_token, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Forgejo OAuth response did not include an access_token.",
        )

    refresh_token = token_data.get("refresh_token")
    refresh_plain = refresh_token if isinstance(refresh_token, str) else None

    expires_in = token_data.get("expires_in")
    access_token_expires_at: datetime | None
    if expires_in is not None:
        access_token_expires_at = datetime.now(UTC) + timedelta(seconds=int(expires_in))
    else:
        access_token_expires_at = None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            user_resp = await client.get(
                f"{base}/api/v1/user",
                headers={"Authorization": f"token {access_token}"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach Forgejo user API: {exc}",
        ) from exc

    if user_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Forgejo user lookup failed with HTTP {user_resp.status_code}: "
                f"{user_resp.text[:500]}"
            ),
        )

    user_json = user_resp.json()
    provider_user_id = str(user_json.get("id", "")).strip()
    provider_username = str(user_json.get("login", "")).strip()
    if not provider_user_id or not provider_username:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Forgejo user response missing id or login.",
        )
    email_val = user_json.get("email")
    email = email_val if isinstance(email_val, str) and email_val.strip() else None

    try:
        user = await find_or_create_user(
            db,
            settings,
            provider="forgejo",
            provider_user_id=provider_user_id,
            provider_username=provider_username,
            email=email,
            access_token_plain=access_token,
            access_token_expires_at=access_token_expires_at,
            refresh_token_plain=refresh_plain,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await create_session(db, response, user.id)
    return RedirectResponse("/dashboard", status_code=status.HTTP_302_FOUND)


@router.get("/logout")
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    myst_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    await revoke_session(db, response, myst_session)
    return RedirectResponse("/", status_code=status.HTTP_302_FOUND)
