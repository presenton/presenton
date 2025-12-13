# Development Guide

## 🚀 Quick Start

### With Makefile (recommended)

```bash
# First time: build and launch in dev mode
make dev-build

# After that, to simply launch
make dev

# See all available commands
make help
```

### Without Makefile

```bash
# Development mode with hot reload
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml up

# Or with initial rebuild
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml up --build
```

## Development with docker-compose-v2

### Development mode (with hot reload)

The `docker-compose-v2.dev.yml` file allows you to develop without having to rebuild Docker images on every change.

#### Getting Started

```bash
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml up
```

Or with initial rebuild if needed:

```bash
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml up --build
```

#### What is mounted as volumes?

**NextJS** (`localhost:3000`):
- `app/`, `components/`, `lib/`, `models/`, `store/`, `types/`, `utils/`
- `presentation-templates/` (hot-reloadable ✨)
- `public/`

**FastAPI** (`localhost:8000`):
- `api/`, `assets/`, `constants/`, `enums/`, `models/`, `services/`, `utils/`
- `static/`

**Caddy**:
- `Caddyfile`

#### Hot reload

- **NextJS**: Next.js development mode automatically reloads
- **FastAPI**: Uvicorn automatically reloads with `--reload`
- **Caddy**: Can be reloaded with `caddy reload`

#### Limitations

Volumes are mounted as **read-only** (`:ro`) to prevent containers from modifying your source code. Only modifications from your host machine are taken into account.

#### When do you need to rebuild?

You only need to rebuild the image if you modify:
- Dependencies (`package.json`, `pyproject.toml`)
- `Dockerfile` files
- System configuration files

### Production mode

To test production mode:

```bash
docker-compose -f docker-compose-v2.yml up
```

## Useful commands

```bash
# Stop containers
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml down

# View logs
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f

# View logs for a single service
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml logs -f nextjs

# Rebuild only one service
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml up --build nextjs

# Execute a command in a container
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml exec nextjs sh
docker-compose -f docker-compose-v2.yml -f docker-compose-v2.dev.yml exec fastapi sh
```

## Development without Docker

If you prefer to develop directly on your machine:

### FastAPI

```bash
cd servers/fastapi
pip install -r requirements.txt
python server.py --port 8000 --reload true
```

### NextJS

```bash
cd servers/nextjs
npm install
npm run dev
```
