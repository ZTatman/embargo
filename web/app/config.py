from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

env_file = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Myst"
    database_url: str = "postgresql+asyncpg://myst:myst@db:5432/myst_db"
    forgejo_base_url: str = ""
    forgejo_pat: str = ""

    model_config = SettingsConfigDict(env_file=str(env_file))


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
