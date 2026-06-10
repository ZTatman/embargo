"""Application error rendering — content-negotiated HTML/JSON error responses."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from app.templating import templates

ERROR_TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    503: "Service Unavailable",
}


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
            },
            status_code=exc.status_code,
        )
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


def register_error_handlers(app: FastAPI) -> None:
    """Wire the application's exception handlers onto the app."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
