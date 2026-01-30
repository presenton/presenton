FROM python:3.11-slim-bookworm

# Set environment variables
ENV PORT=8080
ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/fastapi

# Create necessary directories with permissions
RUN mkdir -p /app_data /tmp/presenton && chmod 777 /app_data /tmp/presenton

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libreoffice \
    fontconfig \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv for faster dependency resolution (inside the stage)
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies directly into the system python
RUN uv pip install --system --no-cache --index-strategy unsafe-best-match -r pyproject.toml

# Copy FastAPI source code
COPY ./ ./

# Ensure entrypoint is executable
RUN chmod +x /app/fastapi/entrypoint.sh

# Expose the port
EXPOSE 8080

# Start the servers
CMD ["/app/fastapi/entrypoint.sh"]
