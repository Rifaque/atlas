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

## Phase 5: Deep OS & Workflow Integration

- **Global Quick Summon** — OS-level shortcut to open Atlas from anywhere (Alt+Space).
- **Live File Watching** — Real-time auto-indexing using native OS file notifications.
- **Native Git Awareness** — Understanding branches, history, and active diffs for RAG context.
- **Editor Handoff** — Deep links to open local files/snippets in your preferred IDE.

## Phase 6: Agentic Capabilities & Actions

- **Tool Calling Engine** — Ability to safely execute bounded shell commands (tests, logs).
- **Workspace Code Application** — Proposing and applying multi-file diffs with user approval.
- **Multi-step Reasoning UI** — Support for visualized Chain-of-Thought thinking processes.
- **Semantic Code Parsing** — Tree-sitter integration for structural indexing (functions vs text).

## Phase 7: Knowledge Graph & Context Mastery

- **GraphRAG** — Semantic knowledge graph extraction for complex relationship discovery.
- **Architecture Visualization** — Interactive node-graph UI to navigate project structure.
- **Cross-Workspace Context** — Ability to query across multiple projects simultaneously.

## Phase 8: v1.0.0 "The Balanced Release"

- **Interactive Onboarding** — Polished setup wizard and tutorial.
- **Accessibility & i18n** — Full keyboard navigation, screen reader support, and localization.
- **Production CI/CD** — Signed, stable installers across Windows, macOS, and Linux.

---

## Phase 9: Desktop Widgets & "Always-on" Interface
- **Menu Bar / System Tray Mode**: Quick access to chat and status from the system bar.
- **Desktop Companion Widgets**: Floating project status, recent changes, and AI "mini-chat" overlays.