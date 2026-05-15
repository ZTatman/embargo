"""Fernet (AES) encryption for OAuth tokens at rest."""

from __future__ import annotations

from cryptography.fernet import Fernet
from pydantic import SecretStr


def fernet_from_encryption_key(key: SecretStr) -> Fernet | None:
    raw = key.get_secret_value().strip()
    if not raw:
        return None
    try:
        return Fernet(raw.encode())
    except Exception as e:
        msg = (
            f"Invalid OAUTH_TOKEN_ENCRYPTION_KEY: {e}. "
            "Generate a valid key with cryptography.fernet.Fernet.generate_key().decode()"
        )
        raise ValueError(msg) from e


def encrypt_oauth_token(fernet: Fernet, raw_token: str) -> str:
    return fernet.encrypt(raw_token.encode()).decode()


def encrypt_optional(fernet: Fernet | None, raw_token: str | None) -> str | None:
    if raw_token is None:
        return None
    if fernet is None:
        msg = (
            "OAuth token encryption is not configured: set OAUTH_TOKEN_ENCRYPTION_KEY "
            "to the output of cryptography.fernet.Fernet.generate_key().decode()"
        )
        raise ValueError(msg)
    return encrypt_oauth_token(fernet, raw_token)


def decrypt_oauth_token(fernet: Fernet, encrypted_token: str) -> str:
    return fernet.decrypt(encrypted_token.encode()).decode()


def decrypt_optional(fernet: Fernet | None, encrypted_token: str | None) -> str | None:
    if encrypted_token is None:
        return None
    if fernet is None:
        msg = (
            "OAuth token encryption is not configured: set OAUTH_TOKEN_ENCRYPTION_KEY "
            "to the output of cryptography.fernet.Fernet.generate_key().decode()"
        )
        raise ValueError(msg)
    return decrypt_oauth_token(fernet, encrypted_token)
