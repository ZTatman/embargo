from __future__ import annotations

import datetime

from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import CheckConstraint, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.crypto import fernet_from_encryption_key
from app.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    forgejo_base_url: Mapped[str] = mapped_column(String, nullable=False)
    forgejo_oauth_client_id: Mapped[str] = mapped_column(String, nullable=False)
    forgejo_oauth_client_secret_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    firebreak_public_base_url: Mapped[str] = mapped_column(String, nullable=False, default="")
    token_encryption_key: Mapped[str] = mapped_column(Text, nullable=False)
    setup_completed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __allow_unmapped__ = True
    _fernet: Fernet | None = None

    def get_fernet(self) -> Fernet:
        """Return a cached Fernet cipher from the stored encryption key."""
        if self._fernet is None:
            fernet = fernet_from_encryption_key(SecretStr(self.token_encryption_key))
            if fernet is None:
                raise ValueError("Token encryption key is missing or empty in app settings.")
            self._fernet = fernet
        return self._fernet
