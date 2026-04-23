import datetime
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import DateTime

# Database engine setup
engine = create_async_engine(
    url="postgresql+asyncpg://myst:myst@db:5432/myst_db",
    connect_args={"connect_same_thread": False},
    echo=True,
)

# Session factory setup
create_async_session = async_sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# Base class for declarative models
class Base(AsyncAttrs, DeclarativeBase):
    type_annotations_map = {
        datetime.datetime: DateTime(timezone=True),
    }


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with create_async_session() as session:
        yield session
