# Atlas Tech Stack

> [!IMPORTANT]
> **CRUCIAL FILE**: This is the authoritative Technical Stack Document for Atlas. Do not delete or move.

## 1. Desktop & Infrastructure
- **Framework**: [Tauri v2](https://v2.tauri.app/) — Native Rust shell for the application lifecycle.
- **Runtime**: Node.js 20+ (Build-time only).
- **CI/CD**: GitHub Actions (Signed Windows/MSI, Linux AppImage/Debian).

## 2. Frontend (The Interface)
- **UI Framework**: React 18
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Tailwind CSS for utility layers).
- **Icons**: Lucide React
- **State Management**: Zustand
- **Animations**: Framer Motion (Subtle transitions).

## 3. Backend (The Engine)
- **Language**: **Rust** (Shared logic between Tauri commands and local agents).
- **Database**: [LanceDB](https://lancedb.com/) — Native Rust vector database.
- **Code Intelligence**: [Tree-Sitter](https://tree-sitter.github.io/tree-sitter/) — Structural semantic parsing.
- **File Watching**: [Notify](https://docs.rs/notify/latest/notify/) — Real-time FS change detection.
- **Crawler**: `ignore` crate — High-performance `.gitignore` aware file walking.

## 4. AI & Inference
- **Local Provider**: [Ollama](https://ollama.com/) — Multi-model local inference.
- **Embedding Model**: `nomic-embed-text` (Hardcoded for 768d consistency).
- **Cloud Gateway**: [OpenRouter](https://openrouter.ai/) — API fallback for advanced cloud models.

## 5. Development Workflow
- **Package Manager**: `pnpm`
- **Build Tool**: Vite
- **Monorepo Manager**: Turborepo
- **Documentation**: Markdown (Standardized PRD, Design, Architecture, Tech Stack).
