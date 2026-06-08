"""Shared Jinja2 template engine — importable without circular deps."""

from pathlib import Path

from jinja2_fragments.fastapi import Jinja2Blocks

TEMPLATES_DIR = Path(__file__).parent / "templates"

templates = Jinja2Blocks(directory=str(TEMPLATES_DIR))
