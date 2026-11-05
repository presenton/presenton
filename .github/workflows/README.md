# GitHub Actions workflows

## CodeQL (`codeql.yml`)

CodeQL scans Python, JavaScript/TypeScript, and GitHub Actions with the
security-extended queries on pushes to `main` and the security fix branch,
and on pull requests targeting `main`. Once present on the default branch,
the workflow can also be started manually for a selected branch.

Each language uploads its analysis to code scanning and retains a SARIF
artifact for 14 days. The scan does not build or publish the application.

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

Install Node.js 22.12+, npm 11.16.0, Python 3.11, and `uv`, then run:

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

The Next.js CI job uses Node.js 22 and pins npm 11.16.0, matching Docker's
frontend dependency installer. npm 10 can report missing lockfile entries such
as `glob@10.5.0` because it resolves range overrides differently. Use the pinned
npm version instead of regenerating the frontend lockfile with npm 10.

```bash
npm install --global npm@11.16.0
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
