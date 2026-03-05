# Atlas

![Atlas Thumbnail](assets/atlas-thumbnail.png)

A local-first AI workspace assistant. Chat with your codebase and documents — entirely on your own machine. Atlas indexes any folder of code, PDFs, or text files and lets you ask natural-language questions about them using locally-running LLMs (via Ollama) or cloud models (via OpenRouter).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Tauri 2 (Rust) |
| **Frontend** | React 18, Vite, TypeScript |
| **Vector Database** | LanceDB (embedded) |
| **Embeddings** | Ollama `nomic-embed-text` |
| **Local LLM** | Ollama (any model) |
| **Cloud LLM** | OpenRouter (optional) |
| **Build System** | Turborepo + pnpm workspaces |

---

## Features

- **Local-First RAG**: High-performance semantic search indexed locally using LanceDB.
- **Privacy by Design**: No file content leaves your machine unless you opt into cloud providers.
- **Multi-Model Support**: Supports any model via Ollama (local) or OpenRouter (cloud).
- **Timeline Intelligence**: Ask questions like "What changed since yesterday?" and get instant summaries.
- **Secret Shield**: Scans outgoing cloud messages to prevent accidental API key leaks.
- **Multi-Step Reasoning**: Visualizes thought process for deep reasoning models.
- **Git Awareness**: Automatically understands your active branch and recent commits.

---

## How to Run (Production)

1.  **Download**: Get the latest installer (`.exe` for Windows, `.AppImage` for Linux) from the [Releases](https://github.com/Rifaque/atlas/releases) page.
2.  **Prerequisites**:
    - Install [Ollama](https://ollama.com).
    - Pull the embedding model: `ollama pull nomic-embed-text`.
    - Pull a chat model (e.g., `ollama pull llama3.2`).
3.  **Launch**: Run the installed application and select a folder to start indexing.

---

## Developer Guide

### Manual Setup
1.  **Clone & Install**:
    ```bash
    git clone https://github.com/Rifaque/atlas.git
    cd atlas
    pnpm install
    ```
2.  **Build Workspace**:
    ```bash
    pnpm run build
    ```
3.  **Run Dev Mode**:
    ```bash
    pnpm --filter desktop exec tauri dev
    ```

---

## Troubleshooting

- **Ollama Offline**: Ensure the Ollama app is running in your system tray.
- **Empty Answers**: Verify `nomic-embed-text` is installed.
- **Build Errors**: Check the [BUILD.md](./BUILD.md) for platform-specific dependencies.

---

## License

MIT © Atlas Team
