FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.7.4 /uv /uvx /bin/

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN useradd --create-home --shell /bin/bash appuser

COPY --chown=appuser:appuser pyproject.toml uv.lock ./
RUN UV_NO_DEV=1 uv sync --frozen --no-cache && chown -R appuser:appuser /app

COPY --chown=appuser:appuser . .

# Build Tailwind CSS
RUN curl -sL https://github.com/tailwindlabs/tailwindcss/releases/download/v4.3.0/tailwindcss-linux-x64 -o /tmp/tailwindcss && \
    chmod +x /tmp/tailwindcss && \
    /tmp/tailwindcss -i app/static/css/input.css -o app/static/css/output.css --minify && \
    rm /tmp/tailwindcss

USER appuser

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]