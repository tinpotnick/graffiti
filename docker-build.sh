#!/bin/bash

set -euo pipefail

echo "Building Tauri bundles with Docker..."

# Build only the export stage and copy artifacts directly to host.
mkdir -p dist-bundle
docker build --target export --output type=local,dest=./dist-bundle .

echo "Build complete. Artifacts are in ./dist-bundle/"
ls -lh dist-bundle/
