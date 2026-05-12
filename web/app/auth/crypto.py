"""Fernet (AES) encryption for OAuth tokens at rest."""

from __future__ import annotations

from cryptography.fernet import Fernet
from pydantic import SecretStr


def fernet_from_encryption_key(key: SecretStr) -> Fernet | None:
    raw = key.get_secret_value().strip()
    if not raw:
        return None
    return Fernet(raw.encode())


def encrypt_oauth_token(fernet: Fernet, plain: str) -> str:
    return fernet.encrypt(plain.encode()).decode()


def encrypt_optional(fernet: Fernet | None, plain: str | None) -> str | None:
    if plain is None:
        return None
    if fernet is None:
        msg = (
            "OAuth token encryption is not configured: set OAUTH_TOKEN_ENCRYPTION_KEY "
            "to the output of cryptography.fernet.Fernet.generate_key().decode()"
        )
        raise ValueError(msg)
    return encrypt_oauth_token(fernet, plain)
