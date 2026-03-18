#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEBSITE_DIR="$ROOT_DIR/website"

mkdir -p "$WEBSITE_DIR/public/img" "$WEBSITE_DIR/public/brand"
cp "$ROOT_DIR/assets/atlas-thumbnail.png" "$WEBSITE_DIR/public/img/atlas-thumbnail.png"
cp "$ROOT_DIR/apps/desktop/src-tauri/icons/icon.png" "$WEBSITE_DIR/public/brand/atlas-icon.png"

echo "Synced Atlas brand assets into website/public."
