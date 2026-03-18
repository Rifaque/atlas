# Changelog

All notable changes to Atlas are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-19 · The Official Release

### ✨ Highlights
- **Golden Master build** — signed Windows (NSIS + MSI) and Linux (AppImage + deb) installers via GitHub Actions.
- **Auto-updater** — in-app update notifications powered by Tauri Updater; `latest.json` served from GitHub Releases.
- **Landing site** — production Next.js launch page at [atlas.rifaque.dev](https://atlas.rifaque.dev) with SEO, OG images, screenshots carousel, and sticky download CTA.

### Added
- **Persona system** — Architect, Security Auditor, and Writer personas with dedicated system prompts.
- **Secret Shield** — scans outgoing OpenRouter messages for API keys and PII before sending; blocks with a confirmation dialog.
- **Timeline Intelligence** — query workspace changes within any time window; feeds directly into chat.
- **Vision support** — attach images to chat messages for multimodal reasoning (model permitting).
- **Command Palette** (Ctrl+K) — fuzzy-search sessions, files, and actions from anywhere in the app.
- **Architecture Graph** — visual representation of the repository dependency graph.
- **Analytics Dashboard** — indexing stats and usage breakdown pane.
- **Zen Mode** (Ctrl+J) — collapses all panels for distraction-free chat.
- **Light & dark themes** — full CSS-token-based theming with per-user accent colour overrides.
- **Overlay window** — floating mini-chat window (always-on-top, transparent, frameless).
- **i18n foundation** — `react-i18next` wiring for future localisation.
- **Web search** — optional Brave/Tavily integration for grounding answers in live web results.
- **Branch chat** — fork any conversation from any message index.
- **Chat export** — download the active session as a Markdown file.
- **Model routing** — per-message model override; supports Ollama local and OpenRouter cloud.
- **Git context injection** — active branch, uncommitted files, and recent commits appended to every system prompt automatically.
- **Inline file viewer** — open any cited file side-by-side in a resizable panel with syntax highlighting.
- **Proposed code diffs** — Atlas-generated JSON diff blocks render as an interactive accept/reject UI.
- **HyDE retrieval** — hypothetical document embeddings for improved semantic search precision.
- **BM25 hybrid search** — keyword + vector search fusion for higher recall.
- **Tree-Sitter GraphRAG** — semantic code graph built at index time for structural context retrieval.
- **Settings 2.0** — tabbed General / Models / System modal with vector compression trigger.

### Changed
- Merged PRD, Design, Architecture, and Roadmap docs into `docs/`.
- README rewritten with concise setup instructions and tech stack overview.
- NSIS installer now includes publisher and long description metadata.

### Fixed
- `llama3` model name automatically migrated to `llama3.2:latest` on workspace open.
- Empty chat sessions no longer accumulate in the session list.
- Progress bar starts at 5 % immediately on indexing to provide instant visual feedback.

---

## [0.10.1] — 2026-03-06 · Pre-Release Polish

- Dead code eliminated across frontend and backend.
- `NOTICE` file added for legal attribution.
- Performance benchmarks documented in `docs/`.

## [0.9.2] — 2026-03-05 · Feature Freeze

- Launch of Secret Shield, Auto-Updater, Vision Support, and Timeline Intelligence.
- Settings refactored into a tabbed modal.
- UI cleanup: redundant Sync Workspace button removed; tooltips added to icon-only controls.

---