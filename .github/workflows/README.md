# GitHub Actions workflows

## Test All Applications (`test-all.yml`)

The test workflow runs on pushes and pull requests to `main`, and can also be
started manually. It enforces the checks that exist in the current repository:

- repository tooling: template-converter tests and bundled export verification;
- FastAPI: every pytest test using the Python version and locked dependencies
  declared in `servers/fastapi`;
- Next.js: all Node.js unit tests, ESLint, a production build, and Cypress
  component tests.

No test step is allowed to fail silently.

## Run the CI checks locally

Install Node.js 20+, npm, Python 3.11, and `uv`, then run:

```bash
./test-local.sh
```

The script installs locked dependencies and runs the same commands as the
GitHub Actions workflow.

## Run one test group

### FastAPI

```bash
cd servers/fastapi
uv sync --locked --dev
mkdir -p /tmp/presenton-tests/app-data /tmp/presenton-tests/temp
APP_DATA_DIRECTORY=/tmp/presenton-tests/app-data \
TEMP_DIRECTORY=/tmp/presenton-tests/temp \
DATABASE_URL=sqlite+aiosqlite:////tmp/presenton-tests/test.db \
DISABLE_ANONYMOUS_TRACKING=true \
DISABLE_IMAGE_GENERATION=true \
uv run --locked python -m pytest --verbose --tb=short
```

### Next.js

```bash
cd servers/nextjs
npm ci
npm test
npm run lint
NEXT_PUBLIC_FAST_API=http://localhost:8000 \
NEXT_PUBLIC_URL=http://localhost:3000 \
npm run build
npx cypress run --component --browser electron
```

### Repository tooling

```bash
npm ci
npm test
npm run sync:presentation-export
npm run check:presentation-export
```
