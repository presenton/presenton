# Contributing to Presenton

Welcome! 🚀  
Thanks for helping improve **Presenton — the open-source AI presentation generator.**

## Quick Links

- **GitHub:** https://github.com/presenton/presenton
- **Docs:** https://docs.presenton.ai
- **Website:** https://presenton.ai
- **Discord:** https://discord.gg/9ZsKKxudNE
- **X:** https://x.com/presentonai

---

# Repository Structure

Presenton ships as both a desktop app (Electron) and a self-hosted Docker image.
Both run the same backend and frontend code:

| Path | What it is | Used by |
| --- | --- | --- |
| `servers/fastapi/` | FastAPI backend (generation, LLM providers, export) | Electron and Docker |
| `servers/nextjs/` | Next.js frontend (UI, editor, settings) | Electron and Docker |
| `electron/` | Desktop shell, packaging, local runtime integrations | Electron only |
| `Dockerfile`, `docker-compose.yml`, `nginx.conf` | Container build and deployment | Docker only |

Contributions to any of these areas are welcome. Because `servers/` is shared,
changes there affect **both** the desktop app and the Docker deployment, so
please make sure they work in both.

---

# How to Contribute

### Bugs
Open an issue and include:

- Steps to reproduce
- Expected vs actual behavior
- Logs or screenshots

### Features
Start a **GitHub Issue** or **Discussion** explaining:

- The problem
- Proposed solution

### Code Contributions

1. Fork the repository
2. Create a branch
3. Implement your changes
4. Open a Pull Request

Example branch names:

```

feature/add-template-support
fix/export-pptx-error
docs/update-readme

```

---

# Development Setup

You can develop against either runtime. Both use the code in `servers/`.

## Electron

### Prerequisites

- Node.js (LTS)
- npm
- Python
- `uv` (Python package manager)

### Setup Environment

From the `electron` directory:

```
cd electron
npm run setup:env
```

This installs:

- Node dependencies
- FastAPI dependencies
- Next.js dependencies

---

### Run the Electron App (Development)

```

npm run dev

```

This will:

- compile TypeScript
- start the Electron app
- run the backend and UI locally

---

### Build the Electron App

To build all components:

```

npm run build:all

```

## Docker

Run the development container from the repository root:

```
docker compose up development
```

---

# Running Tests

From the repository root, run the same checks as CI:

```
./test-local.sh
```

---

# Before Opening a PR

### CLA and PR age policy

Pull requests must have the Contributor License Agreement (CLA) signed before
they can be accepted. Pull requests that remain open for more than 30 days
without a signed CLA may be discarded and closed. Please complete the CLA
prompt as soon as you open a pull request and update the pull request after
signing so maintainers can verify it.

Please ensure:

- Changes to `servers/` work in **both** the Electron app and the Docker image
- Code runs in development as well as in the production build (`npm run build:all` for Electron, `docker compose build` for Docker)
- `./test-local.sh` passes
- PRs are **small and focused**
- You explain **what and why**

For UI changes, include screenshots.

---

# AI-Assisted Contributions

PRs created with **AI tools (ChatGPT, Claude, Codex, etc.) are welcome.**

Please mention:

- that the PR is **AI-assisted**
- the level of testing performed
- confirmation that you reviewed the generated code

---

# Good First Issues

Look for issues labeled:

```

good first issue
help wanted

```

---

# Community

Questions or discussions:

💬 Discord  
https://discord.gg/9ZsKKxudNE

---

# Code of Conduct

Please follow our community guidelines:

```

CODE_OF_CONDUCT.md

```

---

Thanks for helping make **Presenton better for everyone.**
```
