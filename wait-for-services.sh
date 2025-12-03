#!/bin/bash

# Wait for FastAPI to be ready
echo "Waiting for FastAPI to start on port 8000..."
timeout=300
elapsed=0
while ! nc -z localhost 8000; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ $elapsed -ge $timeout ]; then
    echo "FastAPI failed to start within ${timeout} seconds"
    exit 1
  fi
done
echo "FastAPI is ready!"

# Wait for Next.js to be ready
echo "Waiting for Next.js to start on port 3000..."
elapsed=0
while ! nc -z localhost 3000; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ $elapsed -ge $timeout ]; then
    echo "Next.js failed to start within ${timeout} seconds"
    exit 1
  fi
done
echo "Next.js is ready!"

echo "All services are ready. Starting nginx..."
exec nginx -g "daemon off;"
