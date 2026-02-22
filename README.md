# Atlas

> A local-first AI workspace assistant. Chat with your codebase and documents — entirely on your own machine.

Atlas indexes any folder of code, PDFs, or text files and lets you ask natural-language questions about them using locally-running LLMs (via Ollama) or cloud models (via OpenRouter). No file content ever leaves your machine unless you opt into OpenRouter.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full technical deep-dive into how the RAG pipeline works.

---

## Prerequisites

Install all of these before cloning the repo:

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 20+ | https://nodejs.org or `winget install OpenJS.NodeJS` |
| **pnpm** | 10+ | `npm install -g pnpm` or https://pnpm.io/installation |
| **Rust + Cargo** | stable | https://rustup.rs |
| **Ollama** | latest | https://ollama.com/download |
| **ChromaDB** | latest | `pip install chromadb` then `chroma run` |

> **Windows:** You also need the [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required by Tauri/Rust).  
> **Linux:** Run `sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

---

## One-Command Setup

**Windows (PowerShell):**
```powershell
.\install.ps1
```

**macOS / Linux:**
```bash
bash install.sh
```

These scripts auto-install prerequisites (Node, pnpm, Rust, Ollama) if missing, then build and launch the app.

---

## Manual Setup (Step by Step)

### 1. Pull the required Ollama models

Atlas uses two separate models — one for embeddings and one for chat:

```bash
# Required: embedding model (used for indexing & search)
ollama pull nomic-embed-text

# Required: chat/language model (used for generating answers)
ollama pull llama3.2:latest
```

You can use any Ollama-compatible chat model (e.g., `mistral`, `deepseek-coder`, `gemma2`). Only `nomic-embed-text` is mandatory for embeddings.

### 2. Start ChromaDB

ChromaDB must be running before you launch Atlas:

```bash
chroma run
```

It will listen on `http://localhost:8000` by default. Keep this terminal open.

### 3. Clone and install dependencies

```bash
git clone https://github.com/your-org/atlas.git
cd atlas
pnpm install
```

### 4. Build the internal packages

```bash
pnpm run build
```

This builds all the internal packages (`@atlas/chunking`, `@atlas/embeddings`, `@atlas/rag`, `@atlas/retrieval`) that the backend depends on.

### 5. Run in development mode

You have two options:

#### Option A — Run everything through Tauri (recommended for testing the full app)

```bash
pnpm --filter desktop exec tauri dev
```

This starts the Vite dev server, the Tauri shell, and spawns the backend sidecar automatically.

#### Option B — Run backend separately (recommended for debugging)

Terminal 1 — Backend:
```bash
cd apps/backend
pnpm run dev
```

Terminal 2 — Desktop frontend:
```bash
pnpm --filter desktop exec tauri dev
```

Running the backend separately gives you cleaner logs in a dedicated terminal. The Tauri sidecar startup is non-fatal — if the backend is already running on port 47291, the app will use the existing process.

---

## First Use

1. Launch the app
2. Click **Open Folder** and select a directory to index (a code project, a folder of PDFs, etc.)
3. The app will start indexing — you'll see the chunk counter increment in the bottom-left
4. Once indexing starts, you can begin chatting immediately (results improve as more chunks are indexed)
5. Ask natural-language questions about your files in the chat box

---

## Building for Production

### Build the backend as a standalone binary (sidecar)

The production Tauri app bundles the backend as a native binary so users don't need Node.js installed:

```bash
cd apps/backend
pnpm run build:sidecar
```

This compiles the TypeScript, then uses `pkg` to produce a self-contained `.exe` at:
```
apps/desktop/src-tauri/bin/atlas-backend-x86_64-pc-windows-msvc.exe
```

### Build the Tauri app

```bash
cd apps/desktop
pnpm tauri build
```

The installer/executable will be output to `apps/desktop/src-tauri/target/release/bundle/`.

---

## Project Structure

```
atlas/
├── apps/
│   ├── backend/          # Fastify API server (Node.js)
│   │   ├── src/
│   │   │   ├── index.ts      # Route definitions (/api/chat, /api/index, ...)
│   │   │   ├── indexer.ts    # Incremental indexing job runner
│   │   │   ├── crawler.ts    # File walker + PDF/DOCX parser
│   │   │   ├── manifest.ts   # mtime-based incremental index manifest
│   │   │   └── watcher.ts    # Chokidar background file watcher
│   │   └── package.json
│   └── desktop/          # Tauri 2 + React 18 app
│       ├── src/
│       │   ├── components/   # WorkspaceLayout, LandingScreen, SettingsModal, ...
│       │   └── lib/          # API client, chat/workspace/settings storage
│       └── src-tauri/        # Rust shell, capabilities, sidecar config
├── packages/
│   ├── chunking/         # Parent-child text chunking
│   ├── embeddings/       # Ollama /api/embed wrapper
│   ├── rag/              # Prompt builder, HyDE, history summariser, LLM streaming
│   └── retrieval/        # ChromaDB vector store + BM25/RRF/cross-encoder re-ranker
├── ARCHITECTURE.md       # Full technical deep-dive
├── install.ps1           # Windows one-command installer
└── install.sh            # macOS/Linux one-command installer
```

---

## Configuration

All settings are accessible from the ⚙️ Settings modal in the app:

| Setting | Description | Default |
|---|---|---|
| **Chat Model** | Ollama model or OpenRouter model for answering questions | `llama3.2:latest` |
| **Provider** | `ollama` (local) or `openrouter` (cloud) | `ollama` |
| **Ollama Host** | URL of your Ollama instance | `http://127.0.0.1:11434` |
| **OpenRouter API Key** | Optional key for cloud models | _(empty)_ |
| **System Prompt** | Custom instruction prepended to every query | _(empty)_ |

> The embedding model is always `nomic-embed-text` and is not user-configurable — this ensures index and query embeddings always have matching dimensions.

---

## Troubleshooting

**"Backend connection failed"**  
→ Make sure the backend is running: `cd apps/backend && pnpm run dev`  
→ Check that port 47291 is free: `netstat -ano | findstr :47291`

**"Ollama offline" indicator**  
→ Start Ollama: open the Ollama system tray app, or run `ollama serve`

**RAG returns wrong/empty answers**  
→ Make sure `nomic-embed-text` is installed: `ollama pull nomic-embed-text`  
→ If you changed models after an initial index, delete the manifest and re-index:  
  `Remove-Item "$env:USERPROFILE\.atlas\manifests\*.json"`  
  Then click **Re-index** in the app.

**ChromaDB errors**  
→ Make sure ChromaDB is running: `chroma run`  
→ ChromaDB must be on port 8000 (default)

**"Invalid host defined option"**  
→ Your Ollama Host setting is blank or malformed. Go to Settings and set it to `http://127.0.0.1:11434`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Tauri 2 (Rust) |
| Frontend | React 18, Vite, TypeScript |
| Backend | Fastify (Node.js), TypeScript |
| Vector Database | ChromaDB |
| Embeddings | Ollama `nomic-embed-text` |
| Local LLM | Ollama (any model) |
| Cloud LLM | OpenRouter (optional) |
| Build System | Turborepo + pnpm workspaces |
