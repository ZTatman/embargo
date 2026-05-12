from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

env_file = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Myst"
    database_url: str = "postgresql+asyncpg://myst:myst@db:5432/myst_db"  # Default for Docker Compose; override with DATABASE_URL env var in production
    forgejo_base_url: str = ""
    forgejo_pat: SecretStr = SecretStr("")
    forgejo_oauth_client_id: str = ""
    forgejo_oauth_client_secret: SecretStr = SecretStr("")
    # Public Myst base URL for OAuth redirect_uri (no trailing slash). If empty, Request.base_url is used.
    myst_public_base_url: str = ""
    # URL-safe base64 Fernet key (see `cryptography.fernet.Fernet.generate_key()`). Required to persist OAuth tokens.
    oauth_token_encryption_key: SecretStr = SecretStr("")

    model_config = SettingsConfigDict(env_file=str(env_file))


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
