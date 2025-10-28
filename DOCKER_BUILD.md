# Docker Build Instructions

This project uses a **three-stage Docker setup** for optimal build performance and image size:

1. **Dockerfile.base** - Base image with all dependencies
2. **Dockerfile** - Production image (multi-stage with Next.js)
3. **Dockerfile.dev** - Development image

## Quick Start

### Using Docker Compose (Recommended)

Docker Compose will automatically build all images in the correct order:

```bash
# Build base Image before develop or
# Rebuild the base image
docker-compose build base

#  Or rebuild everything at once:
docker-compose build
docker-compose up development

# Development
docker-compose up development

# Development with GPU
docker-compose up development-gpu

# Production
docker-compose up production

# Production with GPU
docker-compose up production-gpu
```

### Manual Build (Advanced)

If you want to build images manually:

```bash
# Step 1: Build the base image
docker build -f Dockerfile.base -t presenton-base:latest .

# Step 2: Build production image
docker build -f Dockerfile -t presenton:latest .

# Or build development image
docker build -f Dockerfile.dev -t presenton-dev:latest .
```

## Image Architecture

### Dockerfile.base (Base Image)
**Purpose:** Contains all system and Python dependencies that rarely change

**Includes:**
- Python 3.11
- Node.js 20
- System packages (nginx, libreoffice, chromium)
- Fonts (Roboto, Prompt for Thai support)
- Ollama
- All Python dependencies (FastAPI, Docling, ChromaDB, etc.)

**Size:** ~2-3 GB (but cached and reused)

**Rebuild when:**
- Adding/updating Python packages
- Installing new system dependencies
- Updating fonts

### Dockerfile (Production)
**Purpose:** Multi-stage build for optimized production deployment

**Stage 1 - Next.js Builder:**
- Builds Next.js application
- Discarded after build

**Stage 2 - Final Runtime:**
- Uses `presenton-base:latest`
- Copies built Next.js from Stage 1
- Copies FastAPI application
- Copies nginx config

**Size:** ~2.5-3.5 GB (optimized)

**Rebuild when:**
- Updating Next.js or FastAPI code
- Changing nginx configuration

### Dockerfile.dev (Development)
**Purpose:** Lightweight image for development with volume mounting

**Uses:**
- `presenton-base:latest`
- Only adds nginx config
- Application code mounted via docker-compose volumes

**Size:** ~2-3 GB (same as base + minimal additions)

**Rebuild when:**
- Base image changes
- Nginx config changes

## Build Optimization Benefits

### 1. Faster Builds
- **First build:** ~10-15 minutes (builds base + app)
- **Code changes:** ~2-3 minutes (only rebuilds app layers)
- **Dependency changes:** ~8-10 minutes (rebuilds base, reuses app layers if unchanged)

### 2. Efficient Caching
```
Base image (cached) ─┬─> Production image
                     └─> Development image
```

### 3. Smaller Development Workflow
- Change FastAPI code → Only rebuilds app layer
- Change Next.js code → Only rebuilds Next.js stage
- Change dependencies → Rebuilds base, others inherit

## CI/CD Recommendations

### GitHub Actions / GitLab CI

```yaml
# Build base image (cache for 30 days or until dependencies change)
- name: Build base image
  run: docker build -f Dockerfile.base -t presenton-base:latest --cache-from presenton-base:latest .

# Build production image
- name: Build production image
  run: docker build -f Dockerfile -t presenton:latest .
```

### Docker Registry

Push base image to registry for faster CI/CD:

```bash
# Tag and push base image
docker tag presenton-base:latest ghcr.io/presenton/presenton-base:latest
docker push ghcr.io/presenton/presenton-base:latest

# Update Dockerfile to use remote base
# FROM ghcr.io/presenton/presenton-base:latest
```

## Environment Variables

All images support the same environment variables (see README.md):

- `LLM` - LLM provider (openai/google/anthropic/ollama/custom)
- `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`
- `IMAGE_PROVIDER` - Image generation provider
- `CAN_CHANGE_KEYS` - Allow runtime key changes
- `WEB_GROUNDING` - Enable web search
- And more...

## Troubleshooting

### Base image not found

```bash
Error: manifest for presenton-base:latest not found
```

**Solution:** Build the base image first:
```bash
docker build -f Dockerfile.base -t presenton-base:latest .
```

Or use docker-compose which builds automatically:
```bash
docker-compose build base
```

### Stale cache issues

```bash
# Rebuild base without cache
docker build -f Dockerfile.base -t presenton-base:latest --no-cache .

# Rebuild production without cache
docker build -f Dockerfile -t presenton:latest --no-cache .
```

### Out of disk space

```bash
# Clean up old images
docker system prune -a

# Remove specific images
docker rmi presenton-base:latest presenton:latest
```

## Font Support

Both Roboto and Prompt fonts are installed in the base image for:
- **Thai language support** (Prompt font)
- **Multilingual support** (Roboto font)
- **PDF/PPTX generation** with proper font rendering

Fonts are installed at:
- `/usr/share/fonts/truetype/roboto/` (via `fonts-roboto` package)
- `/usr/share/fonts/truetype/prompt/` (downloaded from Google Fonts)

## Development Workflow

**Recommended workflow for local development:**

1. **Initial setup:**
   ```bash
   docker-compose build base
   docker-compose up development
   ```

2. **Code changes:**
   - Edit files locally (they're volume-mounted)
   - Changes reflect immediately (hot reload for Next.js)
   - FastAPI requires restart: `docker-compose restart development`

3. **Dependency changes:**
   ```bash
   # Update pyproject.toml or package.json
   docker-compose build base
   docker-compose up development
   ```

4. **Testing production build:**
   ```bash
   docker-compose build production
   docker-compose up production
   ```
