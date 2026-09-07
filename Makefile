# Harness-гейт проекта. Подробности — AGENTS.md.
# check — быстрый детерминированный гейт (~1-2 мин), обязателен перед коммитом.
# check-full — полный паритет с CI (медленно: + next build + cypress).

FASTAPI_DIR := servers/fastapi
NEXTJS_DIR := servers/nextjs
TEST_ENV := APP_DATA_DIRECTORY=/tmp/presenton-tests/app-data \
	TEMP_DIRECTORY=/tmp/presenton-tests/temp \
	DATABASE_URL=sqlite+aiosqlite:////tmp/presenton-tests/test.db \
	DISABLE_ANONYMOUS_TRACKING=true \
	DISABLE_IMAGE_GENERATION=true

.PHONY: setup check check-full fix

setup:
	cd $(FASTAPI_DIR) && uv sync --locked --dev
	npm ci
	cd $(NEXTJS_DIR) && npm ci
	mkdir -p /tmp/presenton-tests/app-data /tmp/presenton-tests/temp

check:
	cd $(FASTAPI_DIR) && uv run ruff check && uv run ruff format --check
	mkdir -p /tmp/presenton-tests/app-data /tmp/presenton-tests/temp
	cd $(FASTAPI_DIR) && $(TEST_ENV) uv run --locked python -m pytest --tb=short -q
	npm test
	cd $(NEXTJS_DIR) && npm test && npm run lint
	cd $(NEXTJS_DIR) && npx tsc --noEmit -p tsconfig.codex-check.json

check-full:
	exec ./test-local.sh

fix:
	cd $(FASTAPI_DIR) && uv run ruff check --fix && uv run ruff format
	cd $(NEXTJS_DIR) && npx eslint . --fix
