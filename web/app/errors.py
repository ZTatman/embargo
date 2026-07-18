"""Application error rendering — content-negotiated HTML/JSON error responses."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from app.auth.session import SESSION_COOKIE, lookup_session
from app.templating import templates

ERROR_TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    503: "Service Unavailable",
}


async def _optional_user(request: Request):
    """Best-effort session lookup so error pages render the right header.

    Exception handlers run outside FastAPI's dependency injection, so the
    session is resolved by hand here. Any failure degrades to None — error
    rendering must never itself raise. A missing/invalid cookie (e.g. a 401)
    correctly yields None, so those pages still show the signed-out header.
    """
    session_factory = getattr(request.app.state, "db_session", None)
    token = request.cookies.get(SESSION_COOKIE)
    if session_factory is None or not token:
        return None
    try:
        async with session_factory() as db:
            sess = await lookup_session(db, token)
            return sess.user if sess else None
    except Exception:
        return None


async def http_exception_handler(request: Request, exc: Exception) -> Response:
    """Render a styled error page for browser requests, JSON for API clients."""
    # Starlette only routes StarletteHTTPException here; narrow for the type
    # checker and re-raise anything unexpected to the default handler.
    if not isinstance(exc, StarletteHTTPException):
        raise exc
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return templates.TemplateResponse(
            request,
            "error.html",
            {
                "status_code": exc.status_code,
                "title": ERROR_TITLES.get(exc.status_code, "Error"),
                "detail": exc.detail,
                "user": await _optional_user(request),
            },
            status_code=exc.status_code,
        )
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


def register_error_handlers(app: FastAPI) -> None:
    """Wire the application's exception handlers onto the app."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
