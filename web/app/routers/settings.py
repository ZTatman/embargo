from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import tokens
from app.auth.session import get_current_session
from app.deps import get_db
from app.models.session import Session as UserBrowserSession
from app.templating import templates

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_class=HTMLResponse)
async def settings_page(
    request: Request,
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> Response:
    return templates.TemplateResponse(
        request,
        "settings.html",
        {
            "user": sess.user,
            "pat_deleted": request.query_params.get("pat") == "deleted",
        },
    )


@router.post("/pat")
async def register_pat(
    pat: Annotated[str, Form()],
    db: Annotated[AsyncSession, Depends(get_db)],
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> RedirectResponse:
    pat = pat.strip()
    if not pat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forgejo access token is required.",
        )

    tokens.set_pat(sess.user, pat)
    await db.commit()

    return RedirectResponse(
        "/settings?pat=registered",
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.post("/pat/delete")
async def delete_pat(
    db: Annotated[AsyncSession, Depends(get_db)],
    sess: Annotated[UserBrowserSession, Depends(get_current_session)],
) -> RedirectResponse:
    tokens.set_pat(sess.user, None)
    await db.commit()

    return RedirectResponse(
        "/settings?pat=deleted",
        status_code=status.HTTP_303_SEE_OTHER,
    )
