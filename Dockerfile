# ===========================
# Stage 1: Next.js Builder
# ===========================
FROM node:20-bookworm-slim AS nextjs-builder

WORKDIR /app/servers/nextjs

# Copy package files
COPY servers/nextjs/package.json servers/nextjs/package-lock.json ./

# Install dependencies
RUN npm install

# Copy Next.js source code
COPY servers/nextjs/ ./

# Build Next.js application
RUN npm run build


# ===========================
# Stage 2: Final Runtime Image
# ===========================
# Use the base image with all dependencies pre-installed
# Build the base image first: docker build -f Dockerfile.base -t presenton-base .
# Or use pre-built: ghcr.io/presenton/presenton-base:latest
FROM presenton-base:latest

# Copy built Next.js application from builder stage
COPY --from=nextjs-builder /app/servers/nextjs/.next /app/servers/nextjs/.next
COPY --from=nextjs-builder /app/servers/nextjs/public /app/servers/nextjs/public
COPY --from=nextjs-builder /app/servers/nextjs/package.json /app/servers/nextjs/package.json
COPY --from=nextjs-builder /app/servers/nextjs/node_modules /app/servers/nextjs/node_modules

# Copy FastAPI application
COPY servers/fastapi/ ./servers/fastapi/

# Copy application files
COPY start.js LICENSE NOTICE ./

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start the servers
CMD ["node", "/app/start.js"]
