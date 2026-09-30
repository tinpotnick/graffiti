# Multi-stage build for Tauri application
FROM node:20-bookworm AS frontend-builder

# Install pnpm
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install frontend dependencies.
# Use --no-frozen-lockfile so Docker builds still work when package.json changed
# but pnpm-lock.yaml has not been regenerated yet.
RUN pnpm install --no-frozen-lockfile

# Copy frontend source
COPY . .

# Build frontend
RUN pnpm run build


FROM rust:bookworm AS tauri-builder

# Install system dependencies required by Tauri
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js and pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && corepack enable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install Node.js dependencies (needed for Tauri CLI)
RUN pnpm install --no-frozen-lockfile

# Copy the entire project
COPY . .

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/build ./build

# Build the Tauri app
RUN pnpm tauri build

# The built artifacts will be in src-tauri/target/release/
# For AppImage: src-tauri/target/release/bundle/appimage/
# For .deb: src-tauri/target/release/bundle/deb/


# Optional: Create a minimal final stage to extract artifacts
FROM scratch AS export

COPY --from=tauri-builder /app/src-tauri/target/release/bundle/ /bundle/
