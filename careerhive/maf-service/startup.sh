#!/bin/bash
set -euo pipefail

APP_PORT="${PORT:-8000}"

if [ -f "requirements.txt" ]; then
	python -m pip install --no-cache-dir -r requirements.txt
fi

python -m uvicorn main:app --host 0.0.0.0 --port "$APP_PORT"
