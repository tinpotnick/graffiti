#!/usr/bin/env bash
# Download the Kubo (IPFS) binary for the current platform.
# Usage: ./scripts/download-kubo.sh [version]
# Example: ./scripts/download-kubo.sh v0.33.0
set -euo pipefail

KUBO_VERSION="${1:-v0.33.0}"
BINARIES_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$ARCH" in
  x86_64)  KUBO_ARCH="amd64"; RUST_ARCH="x86_64" ;;
  aarch64) KUBO_ARCH="arm64"; RUST_ARCH="aarch64" ;;
  arm64)   KUBO_ARCH="arm64"; RUST_ARCH="aarch64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

case "$OS" in
  linux)  TARGET_TRIPLE="${RUST_ARCH}-unknown-linux-gnu" ;;
  darwin) TARGET_TRIPLE="${RUST_ARCH}-apple-darwin" ;;
  *) echo "Unsupported OS: $OS. Add Windows support manually."; exit 1 ;;
esac

BINARY_PATH="${BINARIES_DIR}/ipfs-${TARGET_TRIPLE}"

if [ -f "$BINARY_PATH" ]; then
  echo "Already present: $BINARY_PATH"
  echo "Delete it and re-run to force a fresh download."
  exit 0
fi

URL="https://dist.ipfs.tech/kubo/${KUBO_VERSION}/kubo_${KUBO_VERSION}_${OS}-${KUBO_ARCH}.tar.gz"
echo "Downloading Kubo ${KUBO_VERSION} for ${TARGET_TRIPLE}..."
echo "  ${URL}"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

curl -L --progress-bar "$URL" | tar xz -C "$TMP_DIR"
cp "$TMP_DIR/kubo/ipfs" "$BINARY_PATH"
chmod +x "$BINARY_PATH"

echo "Done: ${BINARY_PATH}"
