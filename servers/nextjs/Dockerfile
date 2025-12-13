# TODO: Transform this to a multi-stage build to reduce image size

FROM node:20-bookworm-slim

ENV PORT=3000

# Install Node.js and npm
RUN apt-get update && apt-get install -y \
    curl \
    fontconfig \
    chromium

# Create a working directory
WORKDIR /app/nextjs 

# Set environment variables
ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install dependencies for Next.js
COPY ./package.json ./package-lock.json ./
RUN npm install

# Copy Next.js app
COPY ./ ./

# Build the Next.js app
RUN npm run build

# Expose the port
EXPOSE $PORT

# Start the server
ENTRYPOINT ["/bin/sh"]
CMD ["/app/nextjs/entrypoint.sh"]
