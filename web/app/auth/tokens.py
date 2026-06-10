"""App-aware token encryption.

The single place that pairs the application Fernet cipher (`get_fernet`) with a
model's ciphertext column. Routers and handlers call these helpers instead of
deriving the cipher and touching the encrypted columns directly, so the at-rest
encryption detail — and any future key rotation — lives in one file.

This sits one layer above `app.auth.crypto`, which holds the cipher primitives
and knows nothing about the application or its models.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.auth.crypto import decrypt_optional, decrypt_token, encrypt_optional, encrypt_token
from app.config import get_fernet

if TYPE_CHECKING:
    from app.models.app_settings import AppSettings
    from app.models.user import User


def decrypt_pat(user: User) -> str | None:
    """Return the user's decrypted Forgejo PAT, or None if none is stored."""
    return decrypt_optional(get_fernet(), user.pat_encrypted)


def set_pat(user: User, raw: str | None) -> None:
    """Store (or clear) a user's Forgejo PAT.

    Passing None clears it. The registered-at stamp is kept in sync with the
    ciphertext so the two columns can never drift apart.
    """
    user.pat_encrypted = encrypt_optional(get_fernet(), raw)
    user.pat_registered_at = datetime.now(UTC) if raw else None


def set_client_secret(app_settings: AppSettings, raw: str) -> None:
    """Encrypt and store the Forgejo OAuth client secret.

    Raises ValueError (from `get_fernet`) when the encryption key is unavailable.
    """
    app_settings.forgejo_oauth_client_secret_encrypted = encrypt_token(get_fernet(), raw)


def decrypt_client_secret(app_settings: AppSettings) -> str:
    """Return the decrypted Forgejo OAuth client secret.

    Raises ValueError when the key is unavailable or the ciphertext can't be
    decrypted (e.g. the encryption key changed).
    """
    return decrypt_token(get_fernet(), app_settings.forgejo_oauth_client_secret_encrypted)
