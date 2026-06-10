from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Request, status
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.auth.crypto import fernet_from_encryption_key

if TYPE_CHECKING:
    from app.models.app_settings import AppSettings

_env_file = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Bootstrap settings loaded from environment variables.

    Only contains fields needed before the database is available.
    Forgejo config lives in the AppSettings DB table after setup.
    """

    app_name: str = "Firebreak"
    database_url: str = "postgresql+asyncpg://firebreak:firebreak@db:5432/firebreak_db"
    token_encryption_key: str = ""
    debug: bool = False

    model_config = SettingsConfigDict(env_file=str(_env_file))


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


@lru_cache
def get_fernet() -> Fernet:
    """Return a cached Fernet cipher from the TOKEN_ENCRYPTION_KEY env var."""
    key = get_settings().token_encryption_key
    if not key:
        raise ValueError(
            "TOKEN_ENCRYPTION_KEY is not set. Add it to your .env file or deployment "
            "environment. Generate one with: uv run python -c "
            "'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    fernet = fernet_from_encryption_key(SecretStr(key))
    if fernet is None:
        raise ValueError(
            "TOKEN_ENCRYPTION_KEY is invalid. Generate a valid key with: uv run python -c "
            "'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return fernet


def current_app_settings(request: Request) -> AppSettings | None:
    """Get AppSettings row, or None if not available.

    This is the source of truth for the live AppSettings row
    """
    return request.app.state.app_settings


def get_app_settings(request: Request) -> AppSettings:
    """FastAPI dependency that requires configured app settings.

    Calls `current_app_settings` directly (rather than depending on it) so the
    only injected parameter is the runtime-resolvable `request` — mirroring how
    `get_current_session` calls `lookup_session`. Raises HTTP 500 when settings
    are unavailable, which should only happen if a route that requires settings
    is reached before setup completes (i.e. not gated by setup middleware).
    """
    settings = current_app_settings(request)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="App settings unavailable — route not gated by setup middleware.",
        )
    return settings


def set_app_settings(app: FastAPI, row: AppSettings | None) -> None:
    """Set application settings on the FastAPI app state."""
    app.state.app_settings = row
