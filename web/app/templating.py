"""Shared Jinja2 template engine — importable without circular deps."""

from pathlib import Path

from jinja2_fragments.fastapi import Jinja2Blocks

from app.config import get_settings

TEMPLATES_DIR = Path(__file__).parent / "templates"

templates = Jinja2Blocks(directory=str(TEMPLATES_DIR))

# Expose the debug flag to every template (gates the dev-only CSS live reload).
templates.env.globals["debug"] = get_settings().debug
