#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export DATABASE_URL="postgresql+asyncpg://myst:myst@localhost:5432/myst_db"
export MYST_PUBLIC_BASE_URL="http://localhost:8000"

echo "Building Tailwind CSS..."
./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css

echo "Starting Myst dev server..."
echo "  FastAPI: http://localhost:8000"
echo "  CSS:     watching app/static/css/input.css"

./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css --watch &
TW_PID=$!

trap "kill $TW_PID 2>/dev/null" EXIT

uv run uvicorn app.main:app --reload --port 8000
