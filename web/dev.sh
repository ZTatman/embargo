#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export DATABASE_URL="postgresql+asyncpg://firebreak:firebreak@localhost:5432/firebreak_db"
export FIREBREAK_PUBLIC_BASE_URL="http://localhost:8000"
export DEBUG="true"  # enables the dev-only CSS live reload

echo "Starting local Postgres and Adminer..."
docker compose -f ../docker-compose.yml up -d db adminer

echo "Building Tailwind CSS..."
./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css

echo "Starting Firebreak dev server..."
echo "  FastAPI: http://localhost:8000"
echo "  Adminer: http://localhost:8080"
echo "           PostgreSQL / db / firebreak / firebreak / firebreak_db"
echo "  CSS:     watching app/templates and app/static/css/input.css"

# Rebuild Tailwind whenever templates or the input CSS change. `entr -d` exits
# when a new file appears in a watched directory, so the loop re-scans and picks
# up newly added templates without needing a manual restart.
if command -v entr >/dev/null 2>&1; then
  (
    while true; do
      find app/templates app/static/css/input.css \
        | entr -d ./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css
    done
  ) &
else
  echo "  (entr not installed — falling back to 'tailwindcss --watch';"
  echo "   new template files will need a dev.sh restart. Install: brew install entr)"
  ./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css --watch &
fi
TW_PID=$!

trap 'kill "$TW_PID" 2>/dev/null; pkill -P "$TW_PID" 2>/dev/null' EXIT

uv run uvicorn app.main:app --reload --port 8000
