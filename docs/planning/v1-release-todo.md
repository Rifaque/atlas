# Atlas V1 Release — Actionable Todo List

This todo list tracks progress against the [V1 Release Plan](v1-release-plan.md).

## 🎨 Phase 1: UI/UX & Atlas Persona ✅ (v0.1.x)
- [x] **Design Systems Refactor** — HSL palette, Geist font, semantic tokens, animations
- [x] **Atlas Persona** — Greeting handler, conversational prompt, random tips
- [x] **Zen Mode** — Centered distraction-free chat (`Ctrl+J`)
- [x] **Command Center** — Spotlight palette with fuzzy search (`Ctrl+K`)
- [x] **Workspace Cards** — Emoji icons, display names, relative timestamps
- [x] **Empty States** — Standardized empty states and loading skeletons

## 🚀 Phase 2: Unified Rust Core ✅ (v0.2.0)
- [x] **Rust file crawler** — Async directory traversal with .gitignore support (`crawler.rs`)
- [x] **Rust manifest** — Incremental indexing with mtime tracking (`manifest.rs`)
- [x] **Rust embeddings** — Ollama `/api/embed` with legacy fallback (`embeddings.rs`)
- [x] **Rust LLM streaming** — Ollama + OpenRouter with Tauri events (`llm.rs`)
- [x] **Rust LanceDB** — Native vector store with arrow arrays (`vectorstore.rs`)
- [x] **Tauri IPC commands** — All routes ported to `#[tauri::command]` (`commands.rs`)
- [x] **Frontend migration** — `fetch()` → `invoke()` / `listen()` (`api.ts`)
- [x] **Removed sidecar** — No more `externalBin`, `start_services`, or backend URL

## ✨ Phase 3: Advanced Features (Next)
- [ ] **Vision support** — Drag-and-drop images, local vision model pipeline
- [ ] **Auto-updater** — Tauri updater plugin with signed GitHub releases
- [ ] **Web search** — Optional Tavily/Serper integration
- [ ] **Timeline Intelligence** — "What changed since yesterday?"
- [ ] **Agentic Personas** — Architect, Writer, Security Auditor sub-prompts
- [ ] **Voice Mode** — Whisper STT + local TTS
- [ ] **Secret Shield** — PII/API key detection for cloud models

## 🛠️ Phase 4: Performance & Polish
- [ ] **Concurrent embedding batches** — Worker pool for faster indexing
- [ ] **Query caching** — Cache common embedding queries
- [ ] **Vector compression** — Quantized embeddings for smaller disk footprint
- [ ] **Settings 2.0** — Searchable, categorized settings modal
- [ ] **System Status** — Ollama version, disk usage, GPU info
