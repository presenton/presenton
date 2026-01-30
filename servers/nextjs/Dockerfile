# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app/nextjs
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-bookworm-slim AS builder
WORKDIR /app/nextjs
COPY --from=deps /app/nextjs/node_modules ./node_modules
COPY ./ ./
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED 1
# Ensure the build uses the distDir from next.config.mjs
RUN npm run build

# Stage 3: Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app/nextjs

# Install chromium for Puppeteer
RUN apt-get update && apt-get install -y \
    curl \
    fontconfig \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT=8080
ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/nextjs/public ./public
COPY --from=builder /app/nextjs/.next-build/standalone ./
COPY --from=builder /app/nextjs/.next-build/static ./.next-build/static
COPY --from=builder /app/nextjs/entrypoint.sh ./entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x ./entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/bin/sh"]
CMD ["/app/nextjs/entrypoint.sh"]
