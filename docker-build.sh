#!/bin/bash

# Docker build script for Tauri application

set -e

echo "Building Tauri application with Docker..."

# Build the Docker image
docker build -t graffiti-build .

# Create output directory
mkdir -p dist-bundle

# Extract the built artifacts
echo "Extracting build artifacts..."
docker create --name graffiti-artifacts graffiti-build
docker cp graffiti-artifacts:/app/src-tauri/target/release/bundle/. ./dist-bundle/
docker rm graffiti-artifacts

echo "Build complete! Artifacts are in ./dist-bundle/"
ls -lh dist-bundle/