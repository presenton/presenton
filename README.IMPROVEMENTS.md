# Presenton — Next.js Frontend (Improvements)

## Summary of Changes
- Added **Husky + lint-staged** pre-commit hook.
- Added **Jest + React Testing Library** for unit tests.
- Added **SVGO** configuration for SVG optimization.
- Created example test (`__tests__/math.test.ts`).
- Enhanced **package.json** with modern scripts and formatting.
- Added `.svgo.yml`, `jest.config.cjs`, and `README.IMPROVEMENTS.md`.

## Usage
```bash
cd servers/nextjs
npm install
npm run prepare     # setup Husky
npm run lint        # run linting
npm run test        # run tests
npm run build       # build production
npm run optimize:svgs  # optimize SVGs
