#!/usr/bin/env bash
# Dev workflow: build the Tauri binary in Docker, run it on the host.
#
# Why: Docker has no display. The host does. We build in Docker (no deps
# needed on host), then execute the binary natively where the display lives.
#
# Host requirement (one-time):
#   sudo dnf install webkit2gtk4.1   # Fedora
#   sudo apt install libwebkit2gtk-4.1-0  # Debian/Ubuntu
set -euo pipefail

cd "$(dirname "$0")/.."

BINARY=".docker-cache/tauri_target/debug/graffiti"

# ── Kubo binary check ─────────────────────────────────────────────────────────
if ! ls src-tauri/binaries/ipfs-* 1>/dev/null 2>&1; then
  echo "Kubo binary not found. Downloading..."
  ./scripts/download-kubo.sh
fi

# ── Build cache directories ───────────────────────────────────────────────────
mkdir -p .docker-cache/{cargo,tauri_target}

# ── Step 1: Vite dev server (background) ─────────────────────────────────────
echo "Starting Vite dev server..."
docker compose up frontend-dev -d

# ── Step 2: Build Tauri binary in Docker ──────────────────────────────────────
echo "Building Tauri binary in Docker (first run downloads crates — be patient)..."
docker compose run --rm tauri-build

# ── Step 3: Run on host ───────────────────────────────────────────────────────
if [ ! -f "$BINARY" ]; then
  echo "ERROR: binary not found at $BINARY — build may have failed."
  exit 1
fi

# Check webkit2gtk is available on the host
if ! ldconfig -p 2>/dev/null | grep -q "libwebkit2gtk"; then
  echo ""
  echo "WARNING: libwebkit2gtk not found on host."
  echo "  Fedora:       sudo dnf install webkit2gtk4.1"
  echo "  Debian/Ubuntu: sudo apt install libwebkit2gtk-4.1-0"
  echo ""
fi

echo "Launching Graffiti (Vite at http://localhost:1420)..."
# Tell the binary where the project root is so it can locate the Kubo sidecar.
# CARGO_MANIFEST_DIR is baked in as the Docker-internal path at compile time;
# this env var gives the correct host path at runtime.
export GRAFFITI_PROJECT_ROOT="$(pwd)"
exec "$BINARY"
