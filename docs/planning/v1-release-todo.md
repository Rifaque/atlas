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

## ✨ Phase 3: Advanced Features ✅
- [x] **Vision support** — Drag-and-drop images, local vision model pipeline
- [x] **Auto-updater** — Tauri updater plugin with signed GitHub releases
- [x] **Web search** — Optional Tavily/Serper integration
- [x] **Timeline Intelligence** — "What changed since yesterday?"
- [x] **Agentic Personas** — Architect, Writer, Security Auditor sub-prompts
- [ ] ~~**Voice Mode** — Whisper STT + local TTS~~ (Skipped per user request)
- [x] **Secret Shield** — PII/API key detection for cloud models

## 🛠️ Phase 4: Performance & Polish ✅
- [x] **Concurrent embedding batches** — Worker pool for faster indexing
- [x] **Query caching** — Cache common embedding queries
- [x] **Vector compression** — Quantized embeddings for smaller disk footprint
- [x] **Settings 2.0** — Searchable, categorized settings modal
- [x] **System Status** — Ollama version, disk usage, GPU info

---

# The Road to v1.0.0

## ⚡ Phase 5: Deep OS & Workflow Integration (v0.5.0)
- [x] **Global Quick Summon** — OS-level shortcut (e.g., `Alt+Space`) to open Atlas from anywhere.
- [x] **Live File Watching** — Implement Rust `notify` crate to watch the workspace and auto-index file changes in real-time.
- [x] **Native Git Awareness** — Understand branches, commit history, and active uncommitted diffs to enrich contextual RAG.
- [x] **Editor Handoff** — "Open in VS Code" buttons on code snippets and files referenced by the LLM.
- [x] **UI Polish & Fixes**:
    - [x] **Window Constraints** — Set minimum width/height for the app window to prevent layout breakage.
    - [x] **Chat Full-stretch** — Fix chat section stretching when sidebars are hidden in "Chat Only" mode.
    - [x] **Persona Blur** — Add background blur (glassmorphism) to the persona selector dropdown.
    - [x] **Resize Logic Fix** — Correct the inverted dragging behavior of the search/chat resizable section.

## 🤖 Phase 6: Agentic Capabilities & Actions ✅ (v0.6.0)
- [x] **Tool Calling Engine** — Equip Atlas with the ability to safely execute bounded shell commands (read logs, run tests).
- [x] **Workspace Code Application** — Allow Atlas to propose code diffs and apply them directly to local files with user confirmation.
- [x] **Multi-step Reasoning UI** — Support and visualize "thinking" chains (Chain of Thought), similar to DeepSeek-R1 or OpenAI o1.
- [x] **Semantic Code Parsing** — Use `tree-sitter` in Rust to index structural code definitions (functions, classes) vs. raw text chunks.

## 🕸️ Phase 7: Knowledge Graph & Context Mastery (v0.7.0)
- [ ] **GraphRAG Implementation** — Extract entities and relationships to build a semantic knowledge graph of the codebase alongside vectors.
- [ ] **Project Architecture Visualization** — A Node-Graph UI view to visually navigate the relationships between local project files.
- [ ] **Cross-Workspace Context** — Ability to seamlessly query across multiple opened workspaces/projects simultaneously.

## 🚀 Phase 8: v1.0.0 Launch Readiness (0.8.0)
- [ ] **Interactive Onboarding** — A polished first-run setup wizard guiding users through model download and folder selection.
- [ ] **Accessibility & i18n** — ARIA compliance audit, keyboard navigation matrix, and localization architecture setup.
- [ ] **Production CI/CD** — Finalizing signed end-to-end Windows, macOS, and Linux builds/installers for a public facing release.

## 🪟 Phase 9: Always-On Efficiency (0.9.0)
- [ ] **System Tray Integration** — Move Atlas to the tray for background indexing and quick wake-up.
- [ ] **Mini-Chat Overlay** — A lightweight, semi-transparent overlay for quick questions without switching contexts.
- [ ] **Desktop Analytics Widget** — A dashboard widget showing real-time indexing speed and project "knowledge coverage."

## 🎯 Phase 10: The Pre "1.0" Polish (0.10.0)
- [ ] **Public Documentation** — Create a polished README, quickstart guide, and feature showcase.
- [ ] **License & Legal** — Finalize MIT license, add NOTICE file, and ensure compliance.
- [ ] **Performance Benchmarks** — Document startup time, indexing speed, and memory usage.
- [ ] **Final Bug Bash** — Community-driven testing to squash last-minute issues.

## 🏁 Phase 11: v1.0.0 - The Official Release (1.0.0)
- [ ] **Golden Master Build** — Final signed and notarized binaries for Windows, and Linux.
- [ ] **Complete UX Polish** — Final pass on all animations, micro-interactions, and visual consistency across the entire app.
- [ ] **Documentation & Tutorials** — Comprehensive user guides and API documentation.
- [ ] **Atlas Website Repository** — Create a dedicated repository for the Atlas project website.
- [ ] **Public Launch & Marketing** — Official announcement, landing page launch, and community outreach on developer platforms.
- [ ] **Post-Release Triage** — Dedicated period for monitoring stability and addressing immediate day-one feedback.
