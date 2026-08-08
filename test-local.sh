#!/usr/bin/env bash

# Run the same test and build checks as .github/workflows/test-all.yml.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED_CHECKS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

run_check() {
    local name="$1"
    shift

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${name}${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if "$@"; then
        echo -e "${GREEN}✓ ${name} passed${NC}"
    else
        echo -e "${RED}✗ ${name} failed${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    echo
}

test_repository_tools() {
    cd "$SCRIPT_DIR" &&
        npm ci &&
        npm test &&
        npm run sync:presentation-export &&
        npm run check:presentation-export
}

test_fastapi() {
    cd "$SCRIPT_DIR/servers/fastapi" || return 1
    uv sync --locked --dev || return 1
    mkdir -p /tmp/presenton-tests/app-data /tmp/presenton-tests/temp || return 1
    APP_DATA_DIRECTORY=/tmp/presenton-tests/app-data \
        TEMP_DIRECTORY=/tmp/presenton-tests/temp \
        DATABASE_URL=sqlite+aiosqlite:////tmp/presenton-tests/test.db \
        DISABLE_ANONYMOUS_TRACKING=true \
        DISABLE_IMAGE_GENERATION=true \
        uv run --locked python -m pytest --verbose --tb=short
}

test_nextjs() {
    cd "$SCRIPT_DIR/servers/nextjs" &&
        npm ci &&
        npm test &&
        npm run lint &&
        NEXT_PUBLIC_FAST_API=http://localhost:8000 \
            NEXT_PUBLIC_URL=http://localhost:3000 \
            npm run build &&
        npx cypress run --component --browser electron
}

for command in uv npm node; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo -e "${RED}Required command not found: ${command}${NC}"
        exit 1
    fi
done

echo "Running the GitHub Actions checks locally from $SCRIPT_DIR"
echo

run_check "Repository tooling tests" test_repository_tools
run_check "FastAPI pytest suite" test_fastapi
run_check "Next.js tests, lint, build, and component tests" test_nextjs

if [[ "$FAILED_CHECKS" -eq 0 ]]; then
    echo -e "${GREEN}All GitHub Actions checks passed.${NC}"
    exit 0
fi

echo -e "${RED}${FAILED_CHECKS} GitHub Actions check(s) failed.${NC}"
exit 1
