# Development Dockerfile for CampusForge (Expo SDK 54)
# Uses Node.js 20 LTS to match CI environment

FROM node:20-bookworm-slim

# Install system dependencies required by Expo and native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies using npm ci for reproducible builds
RUN npm ci

# Copy application source
COPY . .

# Expose Expo/Metro ports
# 8081: Metro bundler
# 8082: Expo dev server (fallback)
# 19000: Expo legacy
# 19001: Expo dev tools
# 19002: Expo dev tools (alternative)
# 19006: Web preview
EXPOSE 8081 8082 19000 19001 19002 19006

# Start Expo in development mode
# --lan enables LAN mode for physical device testing
# --clear clears cache on start for reliability
CMD ["npx", "expo", "start", "--lan", "--clear"]