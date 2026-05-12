from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.session import get_current_session
from app.config import get_settings
from app.database import Base
from app.models.session import Session as UserBrowserSession
from app.routers import auth, links

import app.models  # noqa: F401 - register ORM tables on metadata


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


app = FastAPI(lifespan=lifespan)

app.include_router(auth.router)
app.include_router(links.router)


@app.get("/")
async def root():
    return {"message": "Welcome to Myst"}


@app.get("/dashboard")
async def dashboard(sess: UserBrowserSession = Depends(get_current_session)):
    return {
        "display_name": sess.user.display_name,
        "email": sess.user.email,
    }
