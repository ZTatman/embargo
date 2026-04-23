from datetime import datetime
from typing import Literal

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

GrantType = Literal["public", "private"]


class Grant(Base):
    __tablename__ = "grants"

    id: Mapped[str] = mapped_column(
        Uuid, primary_key=True, server_default=func.gen_random_uuid()
    )
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    repo_owner: Mapped[str] = mapped_column(String, nullable=False)
    repo_name: Mapped[str] = mapped_column(String, nullable=False)
    commit_sha: Mapped[str] = mapped_column(String, nullable=False)
    grant_type: Mapped[GrantType] = mapped_column(
        String, nullable=False, default="public"
    )
    recipient_email: Mapped[str | None] = mapped_column(String, nullable=True)
