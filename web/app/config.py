from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import Request
from pydantic_settings import BaseSettings, SettingsConfigDict

if TYPE_CHECKING:
    from app.models.app_settings import AppSettings

env_file = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Bootstrap settings loaded from environment variables.

    Only contains fields needed before the database is available.
    Forgejo config lives in the AppSettings DB table after setup.
    """

    app_name: str = "Firebreak"
    database_url: str = "postgresql+asyncpg://firebreak:firebreak@db:5432/firebreak_db"

    model_config = SettingsConfigDict(env_file=str(env_file))


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


def get_app_settings(request: Request) -> AppSettings:
    """FastAPI dependency returning the AppSettings row from app state."""
    return request.app.state.app_settings
