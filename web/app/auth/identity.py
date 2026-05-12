from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.crypto import encrypt_optional, fernet_from_encryption_key
from app.config import Settings
from app.models.user import LinkedIdentity, User


async def find_or_create_user(
    db: AsyncSession,
    settings: Settings,
    *,
    provider: str,
    provider_user_id: str,
    provider_username: str,
    email: str | None,
    access_token_plain: str | None,
    access_token_expires_at: datetime | None,
    refresh_token_plain: str | None,
) -> User:
    fernet = fernet_from_encryption_key(settings.oauth_token_encryption_key)

    result = await db.execute(
        select(LinkedIdentity).where(
            LinkedIdentity.provider == provider,
            LinkedIdentity.provider_user_id == provider_user_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        identity.provider_username = provider_username
        if access_token_plain is not None:
            identity.access_token_encrypted = encrypt_optional(fernet, access_token_plain)
            identity.access_token_expires_at = access_token_expires_at
        if refresh_token_plain is not None:
            identity.refresh_token_encrypted = encrypt_optional(fernet, refresh_token_plain)
        user = identity.user
        if email:
            user.email = email
        if not user.display_name:
            user.display_name = provider_username
        await db.commit()
        await db.refresh(user)
        return user

    user = User(email=email, display_name=provider_username)
    db.add(user)
    await db.flush()

    linked = LinkedIdentity(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_username=provider_username,
        access_token_encrypted=encrypt_optional(fernet, access_token_plain),
        access_token_expires_at=access_token_expires_at,
        refresh_token_encrypted=encrypt_optional(fernet, refresh_token_plain),
    )
    db.add(linked)
    await db.commit()
    await db.refresh(user)
    return user
