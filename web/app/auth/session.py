from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db
from app.models.session import Session

SESSION_COOKIE = "myst_session"
SESSION_DURATION_DAYS = 7


async def create_session(db: AsyncSession, response: Response, user_id: uuid.UUID) -> None:
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
    response.set_cookie(
        key=SESSION_COOKIE,
        value=raw_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * SESSION_DURATION_DAYS,
        path="/",
    )


async def get_current_session(
    db: AsyncSession = Depends(get_db),
    myst_session: str | None = Cookie(default=None),
) -> Session:
    if not myst_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not signed in",
        )
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalid or expired",
        )
    sess.last_seen_at = now
    await db.commit()
    await db.refresh(sess, attribute_names=["user"])
    return sess


async def revoke_session(db: AsyncSession, response: Response, myst_session: str | None) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="lax",
        httponly=True,
    )
    if not myst_session:
        return
    token_hash = hashlib.sha256(myst_session.encode()).hexdigest()
    await db.execute(
        update(Session)
        .where(Session.token_hash == token_hash, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
