from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

env_file = Path(__file__).parent.parent / ".env"


@dataclass
class Settings(BaseSettings):
    """Settings for the Myst application.

    Args:
        app_name (str): The name of the application.
        database_url (str): The URL of the database.
        forgejo_base_url (str): The base URL of the Forgejo instance.
        forgejo_pat (str): The Forgejo personal access token.
    """

    app_name: str = "Myst"
    database_url: str = "postgresql://myst:myst@db:5432/myst_db"
    forgejo_base_url: str = ""
    forgejo_pat: str = ""

    model_config = SettingsConfigDict(env_file=str(env_file))


@lru_cache
def get_settings() -> Settings:
    """Get the settings for the application."""
    return Settings()
