# Atlas V1 Release Plan: "The Personal Knowledge Frontier"

This document outlines the roadmap for the V1 release of Atlas. The focus shifts from a "dev-centric tool" to a "personal AI-first workspace" that is elegant, powerful, and accessible to non-developers.

## Phase 1: UI/UX Overhaul & Atlas Persona ✅

> [!NOTE]
> Completed in v0.1.x

- **Design System Refactor** — HSL-based palette, Geist font, semantic tokens, micro-animations
- **Atlas Persona** — Greeting handler, conversational prompt, proactive tips
- **Zen Mode** — Default distraction-free chat with `Ctrl+J` toggle
- **Command Center** — `Ctrl+K` spotlight-style palette with fuzzy search
- **Workspace Cards** — Emoji icons, display names, relative timestamps
- **Empty States & Loading Skeletons** — Standardized across the app

## Phase 2: Unified Rust Core (Sidecar Elimination) ✅

> [!NOTE]
> Completed in v0.2.0

- **Architecture Change**: Frontend → `fetch()` → Fastify sidecar → **eliminated**. Now: Frontend → `invoke()` → Tauri Rust Core.
- **6 Rust Modules**: `crawler.rs`, `manifest.rs`, `embeddings.rs`, `llm.rs`, `vectorstore.rs`, `commands.rs`
- **LanceDB Native**: Using the Rust `lancedb` crate directly instead of Node.js NAPI bindings
- **Frontend Migration**: All `fetch()` calls replaced with Tauri `invoke()`/`listen()`
- **No more port conflicts, sidecar startup failures, or bundled Node.js**

## Phase 3: Advanced Features (Next)

- **Multimodal Vision**: Drag-and-drop images with local vision models (e.g., `llama3.2-vision`)
- **GitHub Releases & Auto-Updater**: Tauri updater plugin with signed releases
- **Web Intelligence**: Optional web search integration (Tavily/Serper)
- **Timeline Intelligence**: "What changed since yesterday?" queries using file history
- **Agentic Personas**: Specialized sub-prompts (Architect, Writer, Security Auditor)
- **Voice Mode**: Local Whisper STT + TTS for spoken interaction
- **Secret Shield**: PII/API key detection for cloud model requests

## Phase 4: Performance & Polish

- **Retrieval Optimization**: Concurrent embedding batches, query caching
- **Vector Compression**: Smaller disk footprint with quantized embeddings
- **Unified Settings 2.0**: Searchable, categorized settings with advanced AI controls
- **System Status Dashboard**: Ollama version, disk usage, GPU info
