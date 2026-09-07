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

# Current Contribution Scope

The repository contains:

- FastAPI backend (`servers/fastapi`)
- Next.js frontend (`servers/nextjs`)
- Docker deployment (nginx all-in-one image)

The desktop (Electron) application was removed; the project is web/Docker-only.

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

### Prerequisites

- Node.js (LTS)
- npm
- Python 3.11
- `uv` (Python package manager)

# Setup Environment

From the repository root:

```
make setup
```

This installs:

- FastAPI dependencies (`uv sync`)
- root npm dependencies
- Next.js dependencies

---

# Run in Development

```
docker compose up development
```

or build and run the all-in-one image directly — see the README.

---

# Before Opening a PR

### CLA and PR age policy

Pull requests must have the Contributor License Agreement (CLA) signed before
they can be accepted. Pull requests that remain open for more than 30 days
without a signed CLA may be discarded and closed. Please complete the CLA
prompt as soon as you open a pull request and update the pull request after
signing so maintainers can verify it.

Please ensure:

- Code runs locally on development as well as build environment both
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
