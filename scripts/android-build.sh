#!/usr/bin/env bash
# Build Graffiti APK for Android via Docker.
#
# Usage:
#   ./scripts/android-build.sh          # Build debug APK
#   ./scripts/android-build.sh --init   # One-time: generate Android project files
set -euo pipefail

cd "$(dirname "$0")/.."

# ── Build cache directories ───────────────────────────────────────────────
mkdir -p .docker-cache/{cargo,gradle,android_target}

case "${1:-}" in
  --init)
    echo "Initialising Android project (one-time)..."
    echo "This generates src-tauri/gen/android/ — commit it when done."
    docker compose run --rm android-init
    echo ""
    echo "Done. Files generated in src-tauri/gen/android/"
    echo "Next steps:"
    echo "  1. Review the generated files"
    echo "  2. git add src-tauri/gen/android/"
    echo "  3. git commit -m 'tauri android init'"
    echo "  4. Run: ./scripts/android-build.sh"
    ;;
  *)
    if [ ! -d "src-tauri/gen/android" ]; then
      echo "ERROR: Android project not initialised."
      echo "Run first: ./scripts/android-build.sh --init"
      exit 1
    fi
    echo "Building debug APK..."
    docker compose run --rm android-build
    echo ""
    echo "APK output:"
    find src-tauri/gen/android/app/build/outputs/apk -name '*.apk' 2>/dev/null || \
      echo "  (check src-tauri/gen/android/app/build/outputs/)"
    ;;
esac
