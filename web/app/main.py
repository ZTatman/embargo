from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.database import Base
from app.routers import links


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database engine lifecycle."""
    settings = get_settings()
    engine = create_async_engine(
        url=settings.database_url,
        pool_pre_ping=True,
        echo=settings.app_name != "Myst",
    )
    app.state.db_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,  # Prevents MissingGreenlet in async
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # Create all tables on startup
    yield
    await engine.dispose()  # Close all connections on shutdown


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    async with app.state.db_session() as session:
        yield session


app = FastAPI(lifespan=lifespan)

app.include_router(links.router)


@app.get("/")
async def root():
    return {"message": "Welcome to Myst"}
