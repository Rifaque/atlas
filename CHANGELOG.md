# Changelog

All notable changes to Atlas are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Atlas uses semantic versioning.

## [1.0.3] - 2026-09-14

### Fixed

- Prevented workspace-root path segments from being treated as direct evidence.
- BM25 now evaluates workspace-relative paths instead of absolute paths.
- Tightened symbol matching so substrings cannot masquerade as exact structural matches.
- Find can now return bounded literal workspace matches even when Ask-style relevance is None.
- Ask remains conservative and continues to decline unsupported questions.
- Replaced misleading authentication examples with the actual workspace-authorization terminology.

## [1.0.2] - 2026-09-13

### Changed

- Replaced the original generic Atlas “A” mark with the final structural Atlas brand identity.
- Updated desktop application, Windows icon set, website, favicon, and repository branding consistently.

This is a branding and polish-only release; it introduces no functional behavior changes.

## [1.0.1] - 2026-09-13

### Fixed

- Preserved bounded, direct workspace evidence for short source-discovery queries that the conservative relevance classifier previously erased.
- Kept Ask conservative while allowing the same bounded direct-evidence fallback used by Find.

### Added

- Final Atlas structural A mark and generated desktop icon family.

## [1.0.0] - Unreleased

### Added

- Evidence-first Ask and Find modes for one indexed workspace.
- Inspectable source passages, file browsing, preview, and workspace-scoped pinned context.
- Workspace-scoped conversation history and generation-provider settings.
- Local Ollama embeddings and generation, with optional explicit OpenRouter generation.
- Identifier-aware BM25 and semantic retrieval combined with Reciprocal Rank Fusion.
- Repeatable retrieval evaluation fixtures and conservative no-evidence handling.
- Factual index health, persistent indexing jobs, and changed-file watching.

### Changed

- Rebuilt the desktop interface around Launcher -> Workspace -> Ask/Find, with History and Evidence as contextual surfaces.
- Made embedding and generation models distinct configuration concepts.
- Bounded evidence, pinned files, history, query, instructions, and Git context under one deterministic context policy.
- Made the complete OpenRouter payload visible as an explicit cloud boundary and inspect it before transmission.
- Updated the index schema to pipeline version 4; earlier indexes require an explicit rebuild.
- Bundled the Atlas license and generated third-party dependency notices with the Windows installer.

### Security

- Made file replacement indexing failure-safe and serialized indexing by workspace.
- Removed arbitrary shell execution, unrestricted file mutation, and unused broad Tauri capabilities.
- Restricted file access to canonical, Rust-authorized workspace roots, including traversal and symlink checks.
- Moved OpenRouter credentials out of frontend persistence into the operating-system credential store.
- Kept the automatic updater disabled because release signing and updater verification are not configured.

### Removed

- Pre-1.0 experimental Graph, analytics, personas, Timeline, Overlay Chat, web search, vision attachments, code actions, model routing, and simulated optimization controls.

## [0.9.2] - 2026-03-05

- Last published pre-1.0 feature-freeze release.

[1.0.0]: https://github.com/Rifaque/atlas/compare/v0.9.2...v1.0.0
[1.0.1]: https://github.com/Rifaque/atlas/compare/v1.0.0...v1.0.1
[1.0.2]: https://github.com/Rifaque/atlas/compare/v1.0.1...v1.0.2
[0.9.2]: https://github.com/Rifaque/atlas/releases/tag/v0.9.2
