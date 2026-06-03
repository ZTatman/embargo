from __future__ import annotations

from typing import Annotated

from cryptography.fernet import Fernet
from fastapi import APIRouter, Cookie, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.crypto import encrypt_token, fernet_from_encryption_key
from app.auth.session import lookup_session
from app.deps import get_db
from app.models.app_settings import AppSettings
from app.templating import templates

router = APIRouter(prefix="/setup", tags=["setup"])


async def _require_auth_if_configured(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    firebreak_session: Annotated[str | None, Cookie()] = None,
) -> None:
    """Block anonymous access to /setup after initial configuration."""
    if not request.app.state.setup_complete:
        return
    sess = await lookup_session(db, firebreak_session)
    if sess is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to reconfigure Firebreak.",
        )


@router.get("", dependencies=[Depends(_require_auth_if_configured)], response_class=HTMLResponse)
async def setup_page(request: Request) -> HTMLResponse:
    """Render the setup wizard. Pre-fills fields when reconfiguring."""
    existing = request.app.state.app_settings
    ctx = {
        "reconfiguring": existing is not None,
        "forgejo_base_url": existing.forgejo_base_url if existing else "",
        "forgejo_oauth_client_id": existing.forgejo_oauth_client_id if existing else "",
        "firebreak_public_base_url": existing.firebreak_public_base_url if existing else "",
    }
    return templates.TemplateResponse(request, "setup.html", ctx)


@router.post("", dependencies=[Depends(_require_auth_if_configured)])
async def setup_submit(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    forgejo_base_url: Annotated[str, Form()],
    forgejo_oauth_client_id: Annotated[str, Form()],
    forgejo_oauth_client_secret: Annotated[str, Form()] = "",
    firebreak_public_base_url: Annotated[str, Form()] = "",
) -> RedirectResponse:
    """Process the setup wizard — creates or updates Forgejo settings."""
    is_reconfiguring = request.app.state.setup_complete

    forgejo_base_url = forgejo_base_url.strip().rstrip("/")
    forgejo_oauth_client_id = forgejo_oauth_client_id.strip()
    forgejo_oauth_client_secret = forgejo_oauth_client_secret.strip()
    firebreak_public_base_url = firebreak_public_base_url.strip().rstrip("/")

    if not forgejo_base_url or not forgejo_oauth_client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forgejo URL and Client ID are required.",
        )

    if is_reconfiguring:
        result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=500, detail="Settings row missing during reconfiguration."
            )
        row.forgejo_base_url = forgejo_base_url
        row.forgejo_oauth_client_id = forgejo_oauth_client_id
        row.firebreak_public_base_url = firebreak_public_base_url
        if forgejo_oauth_client_secret:
            row.forgejo_oauth_client_secret_encrypted = encrypt_token(
                row.get_fernet(), forgejo_oauth_client_secret
            )
        await db.commit()
        await db.refresh(row)
        request.app.state.app_settings = row
        return RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)

    # First-time setup — no auth required (no users exist yet)
    if not forgejo_oauth_client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client Secret is required during initial setup.",
        )

    encryption_key = Fernet.generate_key().decode()
    fernet = fernet_from_encryption_key(SecretStr(encryption_key))
    encrypted_secret = encrypt_token(fernet, forgejo_oauth_client_secret)

    row = AppSettings(
        id=1,
        forgejo_base_url=forgejo_base_url,
        forgejo_oauth_client_id=forgejo_oauth_client_id,
        forgejo_oauth_client_secret_encrypted=encrypted_secret,
        firebreak_public_base_url=firebreak_public_base_url,
        token_encryption_key=encryption_key,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    request.app.state.setup_complete = True
    request.app.state.app_settings = row

    return RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
