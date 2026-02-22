#!/usr/bin/env bash
# One-Command Installer for Atlas (macOS / Linux)
set -e

echo "[Atlas] Starting One-Command Install..."

# 1. Install prerequisites
if ! command -v node >/dev/null; then
    echo "[Atlas] Install Node.js..."
    curl -fsSL https://fnm.vercel.app/install | bash
    source ~/.bashrc || source ~/.zshrc
    fnm install 20
    fnm use 20
fi

if ! command -v pnpm >/dev/null; then
    echo "[Atlas] Installing pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    source ~/.bashrc || source ~/.zshrc
fi

if ! command -v cargo >/dev/null; then
    echo "[Atlas] Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

if ! command -v ollama >/dev/null; then
    echo "[Atlas] Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

if [ "$(uname)" == "Linux" ]; then
    echo "[Atlas] Installing Tauri Linux dependencies..."
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
fi

# 2. Build and launch
echo "[Atlas] Installing dependencies..."
pnpm install

echo "[Atlas] Building monorepo..."
pnpm run build

echo "[Atlas] Launching Desktop App..."
cd apps/desktop
pnpm tauri dev
