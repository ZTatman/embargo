from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.staticfiles import StaticFiles
from jinja2_fragments.fastapi import Jinja2Blocks
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 - register ORM tables on metadata
from app.auth.session import get_current_session, get_optional_session
from app.config import get_settings
from app.database import Base
from app.models.session import Session as UserBrowserSession
from app.routers import auth, links

TEMPLATES_DIR = Path(__file__).parent / "templates"


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


templates = Jinja2Blocks(directory=str(TEMPLATES_DIR))

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
app.include_router(auth.router)
app.include_router(links.router)


@app.get("/")
async def root(request: Request, sess: UserBrowserSession | None = Depends(get_optional_session)):
    return templates.TemplateResponse(
        request,
        "index.html",
        {"user": sess.user if sess else None},
    )


@app.get("/dashboard")
async def dashboard(request: Request, sess: UserBrowserSession = Depends(get_current_session)):
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {"user": sess.user},
    )
