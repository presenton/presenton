# syntax=docker/dockerfile:1.7

FROM python:3.11-slim-trixie AS fastapi-builder

WORKDIR /app/servers/fastapi

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN python -m venv --without-pip /opt/venv \
    && pip install --no-cache-dir uv

COPY servers/fastapi/pyproject.toml servers/fastapi/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --frozen --no-dev --no-emit-project -o /tmp/requirements.txt \
    && uv pip install --python /opt/venv/bin/python -r /tmp/requirements.txt

COPY servers/fastapi /app/servers/fastapi
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /opt/venv/bin/python --no-deps .
# mem0/spaCy BM25 lemmatization loads en_core_web_sm at runtime; spaCy tries pip to
# download it otherwise. Runtime image has no pip in PATH (--without-pip venv).
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /opt/venv/bin/python \
    "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
ENV HF_HOME=/root/.cache/huggingface \
    PRESENTON_FASTEMBED_ICON_CACHE_DIR=/root/.cache/presenton/fastembed-icons
# Warm FastEmbed caches into the image (not a BuildKit cache mount, or HF weights would be missing).
RUN /opt/venv/bin/python scripts/warm_fastembed_cache.py


FROM node:20-bookworm-slim AS nextjs-builder

WORKDIR /app/servers/nextjs

ENV NEXT_TELEMETRY_DISABLED=1

COPY servers/nextjs/package.json servers/nextjs/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY servers/nextjs /app/servers/nextjs
RUN npm run build \
    && rm -rf .next-build/cache


FROM node:20-bookworm-slim AS assets-builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

COPY package.json /app/

RUN mkdir -p /app/document-extraction-liteparse \
    && npm --prefix /app/document-extraction-liteparse init -y \
    && npm --prefix /app/document-extraction-liteparse install @llamaindex/liteparse@1.4.0 --omit=dev

COPY electron/resources/document-extraction/liteparse_runner.mjs /app/document-extraction-liteparse/liteparse_runner.mjs
COPY scripts/sync-presentation-export.cjs /app/scripts/sync-presentation-export.cjs
# Bundled export still loads @img/sharp-* native addons from node_modules (not inlined).
RUN rm -rf /app/presentation-export \
    && node /app/scripts/sync-presentation-export.cjs --force \
    && chmod +x /app/presentation-export/py/convert-linux-x64 \
    && cd /app/presentation-export \
    && npm init -y \
    && npm install "sharp@^0.34.5" --include=optional --omit=dev --no-fund --no-audit --no-package-lock


FROM python:3.11-slim-trixie AS runtime

WORKDIR /app

ARG INSTALL_TESSERACT=true

# LiteParse uses Node + @llamaindex/liteparse (same runner as Electron); OCR uses Tesseract.
ENV APP_DATA_DIRECTORY=/app_data \
    TEMP_DIRECTORY=/tmp/presenton \
    EXPORT_PACKAGE_ROOT=/app/presentation-export \
    EXPORT_RUNTIME_DIR=/app/presentation-export \
    BUILT_PYTHON_MODULE_PATH=/app/presentation-export/py/convert-linux-x64 \
    PRESENTON_APP_ROOT=/app \
    HF_HOME=/root/.cache/huggingface \
    PRESENTON_FASTEMBED_ICON_CACHE_DIR=/root/.cache/presenton/fastembed-icons \
    PATH="/opt/venv/bin:${PATH}" \
    NODE_ENV=production \
    START_OLLAMA=false \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN set -eux; \
    packages="ca-certificates curl nginx fontconfig imagemagick zstd chromium \
      fonts-liberation fonts-noto-core xdg-utils \
      libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
      libcairo2 libcups2t64 libdbus-1-3 libdrm2 libexpat1 libgbm1 \
      libglib2.0-0t64 libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 \
      libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
      libxkbcommon0 libxrandr2 libxshmfence1 libxss1 libxtst6"; \
    if [ "$INSTALL_TESSERACT" = "true" ]; then packages="$packages tesseract-ocr tesseract-ocr-eng"; fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends $packages; \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; \
    apt-get install -y --no-install-recommends nodejs; \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/scripts /app/servers/fastapi /app/servers/nextjs
RUN mkdir -p /app_data/exports /app_data/images /app_data/uploads /app_data/fonts /app_data/pptx-to-html \
    && chmod -R a+rX /app_data

COPY --from=fastapi-builder /opt/venv /opt/venv
COPY --from=fastapi-builder /app/servers/fastapi /app/servers/fastapi
COPY --from=fastapi-builder /root/.cache/huggingface /root/.cache/huggingface
COPY --from=fastapi-builder /root/.cache/presenton/fastembed-icons /root/.cache/presenton/fastembed-icons

COPY --from=assets-builder /app/package.json /app/package.json
COPY --from=assets-builder /app/document-extraction-liteparse /app/document-extraction-liteparse
COPY --from=assets-builder /app/presentation-export /app/presentation-export
COPY --from=assets-builder /app/scripts/sync-presentation-export.cjs /app/scripts/sync-presentation-export.cjs

COPY --from=nextjs-builder /app/servers/nextjs/.next-build/standalone/ /app/servers/nextjs/
COPY --from=nextjs-builder /app/servers/nextjs/public /app/servers/nextjs/public
COPY --from=nextjs-builder /app/servers/nextjs/.next-build/static /app/servers/nextjs/.next-build/static

COPY start.js LICENSE NOTICE ./
COPY scripts/presenton-terminal-banner.mjs /app/scripts/presenton-terminal-banner.mjs
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["node", "/app/start.js"]
