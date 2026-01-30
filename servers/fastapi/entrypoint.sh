#!/bin/sh
set -e
echo "Starting FastAPI server on port ${PORT:-8080}..."
exec python3 server.py --port ${PORT:-8080}
