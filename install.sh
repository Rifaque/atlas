#!/usr/bin/env bash
# Atlas source checkout bootstrap for Linux/macOS.
# This is NOT an end-user installer. It does not install system packages or
# launch development mode.
set -euo pipefail

echo "[Atlas] Developer source bootstrap (not an application installer)"

missing=""
for command in node pnpm cargo protoc; do
  if ! command -v "$command" >/dev/null 2>&1; then
    missing="${missing} ${command}"
  fi
done

if [ -n "$missing" ]; then
  echo "Missing developer prerequisites:${missing}. See README.md and BUILD.md." >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Warning: Ollama is not installed. Builds can continue, but indexing and local runtime QA require Ollama." >&2
fi

pnpm install --frozen-lockfile
pnpm version:check
pnpm build

echo "[Atlas] Source dependencies and production frontend build are ready."
echo "Run 'pnpm --filter desktop tauri dev' for development or follow BUILD.md for release bundles."
