#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WATCH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch) WATCH=1 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

export DATABASE_URL="postgresql+asyncpg://firebreak:firebreak@localhost:5432/firebreak_db"
export FIREBREAK_PUBLIC_BASE_URL="http://localhost:8000"

# --watch is live-reload mode: rebuild CSS on change and enable the
# /api/dev/css-mtime polling endpoint. Off by default so a plain run keeps
# the Network tab clean.
if [ "$WATCH" -eq 1 ]; then
  export DEBUG="true"
else
  export DEBUG="false"
fi

echo "Starting local Postgres and Adminer..."
docker compose -f ../docker-compose.yml up -d db adminer

echo "Building Tailwind CSS..."
./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css

echo "Starting Firebreak dev server..."
echo "  FastAPI: http://localhost:8000"
echo "  Adminer: http://localhost:8080"
echo "           PostgreSQL / db / firebreak / firebreak / firebreak_db"

if [ "$WATCH" -eq 1 ]; then
  echo "  CSS:     watching + browser auto-reload (live-reload mode)"

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
fi

uv run uvicorn app.main:app --reload --port 8000
