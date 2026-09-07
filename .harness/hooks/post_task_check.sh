#!/usr/bin/env bash
set -e
echo "[HARNESS] Running deterministic verification gate..."
make check
echo "[HARNESS] Verification passed."
