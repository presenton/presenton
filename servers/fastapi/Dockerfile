FROM python:3.11-slim-bookworm

ENV PORT=8000

RUN apt-get update && apt-get install -y \
    curl \
    libreoffice \
    fontconfig

# Create a working directory
WORKDIR /app/fastapi  

# Set environment variables
ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton

# Install dependencies for FastAPI
RUN pip install aiohttp aiomysql aiosqlite asyncpg fastapi[standard] \
    pathvalidate pdfplumber chromadb sqlmodel \
    anthropic google-genai openai fastmcp dirtyjson
RUN pip install docling --extra-index-url https://download.pytorch.org/whl/cpu

# Copy FastAPI
COPY ./ ./
COPY --from=parent LICENSE NOTICE ./

# Expose the port
EXPOSE $PORT

# Start the servers
ENTRYPOINT ["/bin/sh"]
CMD ["/app/fastapi/entrypoint.sh"]
