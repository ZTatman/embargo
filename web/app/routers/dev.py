"""Development-only endpoints. Included on the app only when debug is enabled."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/dev", tags=["dev"])

_CSS_OUTPUT = Path(__file__).parent.parent / "static" / "css" / "output.css"


@router.get("/css-mtime")
async def css_mtime() -> dict:
    """Report the built CSS file's mtime so the browser can live-reload on change."""
    if _CSS_OUTPUT.exists():
        return {"mtime": _CSS_OUTPUT.stat().st_mtime}
    return {"mtime": 0}
