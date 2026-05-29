from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from jinja2_fragments.fastapi import Jinja2Blocks
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import models as _models  # noqa: F401 - register ORM tables on metadata
from app.auth.crypto import encrypt_optional, fernet_from_encryption_key
from app.auth.session import get_current_session, get_optional_session
from app.config import Settings, get_settings
from app.database import Base
from app.deps import get_db
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
async def root(
    request: Request, sess: Annotated[UserBrowserSession | None, Depends(get_optional_session)]
):
    return templates.TemplateResponse(
        request,
        "index.html",
        {"user": sess.user if sess else None},
    )


@app.get("/dashboard")
async def dashboard(
    request: Request, sess: Annotated[UserBrowserSession, Depends(get_current_session)]
):
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "user": sess.user,
            "pat_registered": request.query_params.get("pat") == "registered",
        },
    )


@app.post("/dashboard/pat")
async def register_pat(
    pat: Annotated[str, Form()],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> RedirectResponse:
    pat = pat.strip()
    if not pat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Forgejo access token is required."
        )

    fernet = fernet_from_encryption_key(settings.token_encryption_key)
    sess.user.pat_encrypted = encrypt_optional(fernet, pat)
    await db.commit()

    return RedirectResponse(
        "/dashboard?pat=registered#forgejo-access-token",
        status_code=status.HTTP_303_SEE_OTHER,
    )
