#!/usr/bin/env bash
set -euo pipefail

echo "Starting Myst dev server..."
echo "  FastAPI: http://localhost:8000"
echo "  CSS:     watching app/static/css/input.css"

# Start Tailwind CSS watcher in background
./tailwindcss -i ./app/static/css/input.css -o ./app/static/css/output.css --watch &
TW_PID=$!

# Trap to kill tailwind watcher on exit
trap "kill $TW_PID 2>/dev/null" EXIT

# Start uvicorn
uv run uvicorn app.main:app --reload --port 8000
