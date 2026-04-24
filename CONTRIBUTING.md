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

The Electron application contains:

- Desktop application
- FastAPI backend
- Next.js frontend
- Local runtime integrations

Contributions outside `electron/` may not be accepted at this time.

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

# Development Setup (Electron)

### Prerequisites

- Node.js (LTS)
- npm
- Python
- `uv` (Python package manager)

# Setup Environment

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

# Run the Electron App (Development)

```

npm run dev

```

This will:

- compile TypeScript
- start the Electron app
- run the backend and UI locally

---

# Build the Electron App

To build all components:

```

npm run build:all

```

---

# Before Opening a PR

Please ensure:

- Changes are **inside `electron/`**
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
