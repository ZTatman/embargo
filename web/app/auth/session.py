from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.session import Session

SESSION_COOKIE = "myst_session"
SESSION_DURATION_DAYS = 7


async def create_session(
    db: AsyncSession, response: Response, user_id: uuid.UUID, secure: bool = True
) -> None:
    """Create a persisted browser session and set its cookie on the response."""

    # The browser gets the raw token, but the database only stores its hash.
    # This keeps a leaked sessions table from containing usable cookie values.
    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=SESSION_DURATION_DAYS)
    row = Session(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(row)
    await db.commit()
    # HttpOnly keeps client-side scripts from reading the session cookie. Lax is
    # enough for normal navigation while reducing cross-site request exposure.
    response.set_cookie(
        key=SESSION_COOKIE,
        value=raw_token,  # raw token is stored in the cookie, not the hash
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=60 * 60 * 24 * SESSION_DURATION_DAYS,
        path="/",
    )


async def _lookup_session(
    db: AsyncSession,
    myst_session: str | None,
) -> Session | None:
    """Return the active session for a raw cookie token, if one exists."""

    # Missing cookie means anonymous request. Callers decide whether anonymous is
    # acceptable with get_optional_session or should become a 401.
    if not myst_session:
        return None
    # Match the incoming cookie by hashing it the same way create_session did.
    # Only active, non-expired sessions are accepted.
    token_hash = hashlib.sha256(myst_session.encode()).hexdigest()
    now = datetime.now(UTC)
    stmt = (
        select(Session)
        .options(selectinload(Session.user))
        .where(
            Session.token_hash == token_hash,
            Session.expires_at > now,
            Session.revoked_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    if sess is None:
        return None
    # Track activity whenever a valid cookie is used, then refresh the related
    # user so route handlers can safely access sess.user.
    sess.last_seen_at = now
    await db.commit()
    await db.refresh(sess, attribute_names=["user"])
    return sess


async def get_current_session(
    db: Annotated[AsyncSession, Depends(get_db)],
    myst_session: Annotated[str | None, Cookie()] = None,
) -> Session:
    """FastAPI dependency that requires a valid signed-in session."""

    # Use this dependency on routes that require a signed-in user.
    sess = await _lookup_session(db, myst_session)
    if sess is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not signed in",
        )
    return sess


async def get_optional_session(
    db: Annotated[AsyncSession, Depends(get_db)],
    myst_session: Annotated[str | None, Cookie()] = None,
) -> Session | None:
    """FastAPI dependency that returns the current session when available. Used on pages that can render differently for anonymous and signed-in users."""

    return await _lookup_session(db, myst_session)


async def revoke_session(db: AsyncSession, response: Response, myst_session: str | None) -> None:
    """Delete the browser cookie and mark the matching session as revoked."""

    # Always ask the browser to delete its cookie, even if the DB row is already
    # missing or revoked.
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="lax",
        httponly=True,
    )
    if not myst_session:
        return
    # Revoke by hash for the same reason we store sessions by hash: the raw
    # cookie token should only exist in the browser.
    token_hash = hashlib.sha256(myst_session.encode()).hexdigest()
    result = await db.execute(
        update(Session)
        .where(Session.token_hash == token_hash, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()

    # Bypasses the strict static type checking check safely
    rowcount = getattr(result, "rowcount", 0)
    if rowcount == 0:
        pass
