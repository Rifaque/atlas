# Atlas 1.0 Tech Stack

> [!IMPORTANT]
> **CRUCIAL FILE**: Do not delete or move this document.

## Desktop

- Tauri 2 with Rust 1.77.2+
- Narrow Tauri IPC and event streams
- Folder-selection dialog plugin only

## Frontend

- React 19 and TypeScript
- Vite and Tailwind CSS utility layers
- Local hooks/reducers for domain state; no global state library
- React Markdown for generated text and Lucide for icons

## Backend

- LanceDB and Apache Arrow for local vector data
- Tree-sitter for language-aware code chunking
- `ignore` for `.gitignore`-aware crawling
- `notify` for changed-file watching
- `git2` for read-only basic Git context
- OS credential storage through `keyring`

## Inference

- Ollama for local embeddings and local generation
- OpenRouter as an optional, explicitly authorized generation provider
- Embedding and generation models are separate contracts

## Development

- Node.js 20+, pnpm 10.4.1, Turborepo
- Vitest, ESLint, TypeScript, Cargo test, Clippy, and rustfmt
