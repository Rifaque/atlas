# Atlas 1.0 Architecture

> [!IMPORTANT]
> **CRUCIAL FILE**: Do not delete or move this document.

## Runtime shape

Atlas is a Tauri 2 desktop application with a React/TypeScript frontend and a Rust backend. Retained behavior uses narrow Tauri commands and job events; there is no sidecar HTTP service, arbitrary shell IPC, or diff-application IPC.

## Product domains

- **Launcher** owns recent workspaces and opening/removing launcher registrations.
- **Workspace shell** owns exactly one canonical active workspace.
- **Ask** owns generation and the evidence attached to each response.
- **Find** owns ranked workspace search.
- **Evidence** owns source references, file navigation, previews, and pinned context.
- **History** owns workspace-scoped sessions and the active session.
- **Settings** owns real general, model/privacy, indexing, and advanced configuration.

Frontend behavior is split into workspace-history, indexing, evidence, and chat hooks. The workspace layout composes those domains rather than owning their state machines.

## Index and retrieval

The Rust crawler respects `.gitignore` and Atlas generated-directory exclusions. Parsing/chunking and all embeddings complete before a replacement is committed. A manifest hash is updated only after durable vector data succeeds. One indexing job runs per workspace; repeated requests are coalesced, deleted-file data is removed after success, and relevant query caches are invalidated.

LanceDB stores chunks and their workspace/file/line/symbol metadata. Query retrieval takes up to 40 semantic candidates and independently scores the committed workspace rows with identifier-aware BM25 over content, path, symbol name, and chunk kind. Reciprocal Rank Fusion uses `k=60` to combine the ranked lists without comparing incompatible raw score scales. Identical and substantially overlapping line ranges are suppressed before the final Ask/Find limit.

A conservative strong/weak/none decision uses the calibrated combination of lexical and semantic signals. A `none` result returns no evidence; Ask then declines workspace-specific generation unless the user supplied explicit pinned context. Raw vector distance and BM25/RRF scores remain internal and are never presented as confidence.

The backend converts selected results into a stable evidence result with a canonical workspace ID, source ID, path/display path, 1-based line range, content/snippet, and source type. Ask supplies at most eight evidence items and labels them `[S1]`â€“`[S8]` in the generation prompt. The UI describes these as evidence considered unless the model actually emits a valid source reference.

Prompt inputs share a deterministic 25,000-character approximation budget: 9,000 evidence, 6,000 pinned context, 4,000 history, 2,000 instructions/Git metadata, and 4,000 query characters. Evidence is capped at 2,500 characters per source and pinned files at 2,000 each. These are conservative Unicode-safe character approximations, not claimed token counts.

TypeScript and TSX use their matching tree-sitter grammars. Markdown is chunked by heading section, with bounded 80-line segments and 10-line overlap only for unusually long sections. Index pipeline version 4 requires one rebuild of older indexes so chunking generations are not mixed. Lexical scoring reads the same committed Lance rows as vector search; no separately mutable lexical store can diverge during update/delete/rename transactions.

## Providers and privacy

Embedding configuration is workspace-owned and distinct from generation configuration. Ollama host configuration is used by health checks, model discovery, embeddings, indexing, retrieval, and chat. OpenRouter is generation-only.

Before OpenRouter can be called, the frontend explicitly authorizes the request and Rust constructs one complete bounded outbound payload. The local outbound policy scans the query, evidence, pinned content, history, Git/system context, and instructions. Blocked payloads never reach the provider. Provider credentials are Rust-owned through the OS credential store and are not persisted in frontend storage.

## Security boundaries

The backend owns workspace authorization. File operations canonicalize the authorized root and target, reject traversal/outside-root paths, and prevent symlink escape. Tauri capabilities retain only core and folder-selection permissions. The application CSP allows bundled content, IPC, and configured local Ollama traffic; arbitrary shell and broad filesystem plugin permissions are absent.
