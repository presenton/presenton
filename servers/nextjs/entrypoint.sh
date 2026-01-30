#!/bin/sh
set -e
echo "Starting Next.js server on port ${PORT:-8080}..."
# Next.js standalone server uses PORT environment variable
exec node server.js
