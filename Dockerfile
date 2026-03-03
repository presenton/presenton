# ============================================
# Stage 1: Build Next.js application
# ============================================
FROM node:20-slim AS nextjs-builder

WORKDIR /build

# Install dependencies first (layer cache optimization)
COPY servers/nextjs/package.json servers/nextjs/package-lock.json ./
RUN npm ci

# Copy source and build
COPY servers/nextjs/ ./
RUN npm run build

# ============================================
# Stage 2: Final runtime image
# ============================================
FROM python:3.11-slim-bookworm

# Install system dependencies in a single layer and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    libreoffice-impress \
    fontconfig \
    chromium \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && rm -rf /usr/share/doc/* /usr/share/man/* /usr/share/locale/* \
              /usr/share/info/* /usr/share/lintian/*

# Create a working directory
WORKDIR /app

# Set environment variables
ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Python dependencies with no cache, strip PyTorch bloat
RUN pip install --no-cache-dir \
    aiohttp aiomysql aiosqlite asyncpg fastapi[standard] \
    pathvalidate pdfplumber chromadb sqlmodel \
    anthropic google-genai google-cloud-storage openai fastmcp dirtyjson \
    && pip install --no-cache-dir docling --extra-index-url https://download.pytorch.org/whl/cpu \
    && find /usr/local/lib/python3.11/site-packages/torch -name "*.so" -exec strip --strip-unneeded {} + 2>/dev/null || true \
    && rm -rf /usr/local/lib/python3.11/site-packages/torch/test \
             /usr/local/lib/python3.11/site-packages/torch/include \
             /usr/local/lib/python3.11/site-packages/torch/share \
             /usr/local/lib/python3.11/site-packages/nvidia/*/lib/*.a \
             /usr/local/lib/python3.11/site-packages/docling/resources \
    && find /usr/local/lib/python3.11/site-packages -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

# Copy the built Next.js standalone app from the builder stage
COPY --from=nextjs-builder /build/.next-build/standalone /app/servers/nextjs
COPY --from=nextjs-builder /build/.next-build/static /app/servers/nextjs/.next-build/static
COPY --from=nextjs-builder /build/public /app/servers/nextjs/public

# Copy FastAPI source
COPY servers/fastapi/ ./servers/fastapi/

# Copy entrypoint and nginx config
COPY start.js ./
COPY nginx.conf /etc/nginx/nginx.conf

# Expose the port
EXPOSE 80

# Start the servers
CMD ["node", "/app/start.js"]