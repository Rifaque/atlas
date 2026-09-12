# Atlas v0.9.2 Comprehensive Product & Repository Audit

**Audit date:** 2026-09-04
**Requested baseline:** Atlas 0.9.2
**Audited baseline:** the current, already-modified working tree (manifests identify it as 1.0.1; see Scope)
**Overall health:** **4.5/10**

## Scope, method, and evidence language

This was a read-only code, configuration, documentation, build, test, and limited runtime audit. Application code was not changed. This report is the only intentional repository modification.

The checkout was already substantially dirty before the audit: 30 tracked files were modified, `apps/desktop/src/lib/toast.tsx` was deleted, and several files plus `apps/desktop/src-tauri/target-codex/` were untracked. Findings therefore describe the **current working tree**, not a reproducible v0.9.2 tag. Git history contains no v0.9.2 tag, and the current manifests say 1.0.1. Existing user changes were preserved.

Labels used below:

- **FACT** — directly observed in source, configuration, test output, or the limited runtime attempt.
- **INFERENCE** — a likely consequence that needs a focused runtime test to prove.
- **RECOMMENDATION** — proposed direction; nothing in this document was implemented.

## A. Executive Summary

Atlas has a credible product kernel: a Tauri desktop shell, local folder ingestion, semantic chunking, LanceDB storage, Ollama embeddings/chat, streaming answers, file evidence, and useful workspace inspection. The current desktop frontend builds, Rust checks and tests pass, and the website builds and tests. This is a better foundation than the product's visual and feature sprawl suggests.

However, Atlas is not yet a trustworthy 1.0 foundation. The indexing transaction is unsafe: it deletes old chunks and records files as indexed before replacement embeddings are durable. Several prominent controls—personas, web search, image attachments, context scope, stop generation, storage optimization—are disconnected or simulated. Cloud chat sends retrieved source, manual files, Git metadata, and history to OpenRouter after scanning only the user's typed query. Update signing is configured with a placeholder key. Retrieval is an unbounded, weakly ranked vector-plus-`ILIKE` merge that is described in documentation as BM25/RRF/HyDE/GraphRAG even though those mechanisms do not exist.

The primary problem is not merely code cleanliness or visual age. Atlas currently presents too many partially integrated identities: chat app, code explorer, model playground, analytics product, graph viewer, command surface, and overlay assistant. The refresh should first reduce the product to a dependable **workspace intelligence** loop: open one workspace, understand indexing health, ask or find, inspect exact evidence, and control explicitly whether any evidence leaves the machine.

The strongest area is the coherent local desktop/Rust ingestion foundation and the fact that the main build is healthy. The weakest area is end-to-end truthfulness and reliability across indexing, retrieval, cloud privacy, and UI-to-backend contracts.

## B. Current Product Definition

**FACT:** Atlas today is a single-user Tauri desktop application that stores workspace registrations and conversations in browser `localStorage`, crawls selected folders in Rust, chunks supported source/text/PDF files, embeds chunks through an Ollama HTTP server, persists vectors in a global LanceDB under the user's home directory, and answers through Ollama or OpenRouter using retrieved chunks and optional Git/manual-file context.

It also exposes file search/tree/preview, pinned context, chat history/export/branching, model and persona selectors, an architecture graph, timeline, synthetic analytics, themes/accent/zen modes, global overlay chat, update checking, proposed whole-file edits, secret scanning, and dormant web/shell/setup facilities.

**INFERENCE:** Because many secondary surfaces are shallow, disconnected, or inaccurate, users are likely to perceive Atlas as an ambitious model playground with a code explorer rather than a dependable evidence-first workspace tool.

**RECOMMENDATION:** Define Atlas 1.0 as a local-first workspace intelligence desktop app, not a general agent platform. Make indexing integrity, retrieval quality, evidence inspection, and an explicit cloud boundary the product.

## C. Architecture Map

```text
React 19 / Vite 7 desktop UI
  App.tsx
    LandingScreen -> workspace registration + initial indexing
    WorkspaceLayout -> chats, tools, model/persona/context, watcher lifecycle
    SettingsModal / CommandPalette / OverlayChat / UpdateChecker
  localStorage -> workspaces, active IDs, chats, settings, theme/UI preferences
  lib/api.ts -> Tauri invoke/event DTOs
                         |
                         v
Tauri 2 command boundary (src-tauri/src/lib.rs, commands.rs)
  crawler.rs -> full folder traversal and file loading
  parser.rs -> tree-sitter declarations or 50-line fallback chunks
  embeddings.rs -> Ollama /api/embeddings
  vectorstore.rs -> LanceDB vector tables + relationship table
  llm.rs -> Ollama/OpenRouter streaming HTTP
  git.rs -> branch/status/recent commits
  watcher.rs -> notify debouncer -> full incremental-index command
  manifest.rs -> ~/.atlas/manifests/*.json
  shield.rs / websearch.rs -> secret patterns / Tavily or Serper client
  LanceDB -> ~/.atlas/lancedb
```

### Repository and build layout

- Root `package.json` is a pnpm 10.4.1/Turborepo coordinator. `pnpm-workspace.yaml` includes only `apps/*`.
- `apps/desktop` is the Tauri/React product. `apps/website` is a separate Next.js project with its own npm lockfile and is not part of the pnpm workspace.
- `.github/workflows/release.yml` builds desktop releases; `.github/workflows/website-ci.yml` validates the website.
- Documentation lives in `README.md`, `CHANGELOG.md`, `docs/`, and a largely untouched Vite template README in `apps/desktop`.

### Frontend boundaries and state

`App.tsx` owns initial workspace restoration, landing/workspace routing, overlay-window branching, theme initialization, and the updater. `WorkspaceLayout.tsx` then owns nearly every workspace concern in one 1,261-line component: chat session mutation, streaming, search, file tree, manual context, Git/timeline, watcher lifecycle, model health polling, tools, panels, and much of the navigation.

There is no effective shared application state layer. State is component-local and persisted through independent helpers:

- `src/lib/workspaces.ts`: `atlas_workspaces`, `atlas_active_workspaces`, and migration from `atlas_active_workspace`.
- `src/lib/chats.ts`: global `atlas_chats`, capped at 50 but not scoped to a workspace.
- `src/lib/settings.ts`: `atlas_settings`, including plaintext API keys.
- Theme/accent/zen preferences use separate localStorage keys.

`zustand` is declared but unused. There is no schema version, validation, transactional persistence, or migration framework beyond the active-workspace key fallback.

### Backend ownership and persistence

`src-tauri/src/commands.rs` is a 941-line orchestration/god module containing indexing, retrieval context construction, chat, file access, shell execution, and diff application. `AppState` owns a global vector store, indexing-job map, LRU query cache, and watcher map. Indexing jobs are inserted but have no status command or cleanup path.

LanceDB tables are global and dimension-specific (`atlas_v2_<dimension>`); workspace identity is stored per row as the folder path. Manifests are separate JSON files named from a normalized/truncated path slug. This split makes the manifest the only incremental-index authority while data durability lives elsewhere.

### IPC and boundary violations

- Frontend DTOs advertise `persona`, web-search fields, and `images`; Rust `ChatRequest` does not define them, so Serde ignores them.
- The backend exposes arbitrary `execute_shell_command`, `read_file`, and `apply_diff` commands rather than workspace-bounded domain operations.
- UI and Rust disagree about workspace identity in overlay chat: random frontend workspace IDs versus folder paths in vector rows.
- Retrieval, prompt assembly, privacy decisions, provider selection, Git collection, and transport are combined inside one command.
- Frontend settings include `contextSlots`, but backend retrieval is hard-coded.

### Build, runtime, and release health

| Check | Result | Evidence / consequence |
|---|---|---|
| Dependency state | Installed | Root, desktop, and website dependency directories existed. |
| Desktop ESLint | PASS | No reported violations. |
| Desktop TypeScript + Vite build | PASS with warning | 3,043 modules; main JS 1,348.48 kB (448.58 kB gzip); shell plugin is both static and dynamic, so its dynamic import is not split. |
| Website lint/typecheck/test/build | PASS with warning | Two files/four tests pass; `caniuse-lite` is six months old. Next 15.5.12 build succeeds. |
| `cargo check --all-targets` | PASS | Clean. |
| `cargo test --all-targets` | PASS | Four Secret Shield tests; binary target has zero tests. Fresh compile took about 4m06s. |
| `cargo fmt --check` | PASS | No formatting diff. |
| `cargo clippy --all-targets -- -D warnings` | FAIL | Five findings: type complexity, cloned ref, manual char comparison, `&mut Vec` argument, needless range loop. |
| Desktop runtime attempt | INCONCLUSIVE | Tauri launched, but the dev watcher repeatedly reacted to pre-existing `src-tauri/target-codex` artifacts and restarted. A blank white Atlas window was observed during this loop; normal app behavior was not established. |

The locally available environment was Node 22.14, pnpm 10.4.1, npm 10.9.2, and Rust 1.93. Repository evidence supports pnpm 10.4.1, Node 20+ in docs but Node 24 in CI, and Rust 1.77.2 minimum/stable CI. That inconsistency should be resolved before onboarding contributors.

## D. Current User Journey

1. Launch loads localStorage and either shows a workspace list or opens restored active workspaces.
2. User selects a folder, chooses provider/model, and starts indexing.
3. Rust crawls and fully reads eligible files, chunks changed files, calls Ollama embeddings, and writes LanceDB/manifests while emitting progress.
4. Workspace opens into chat. Zen mode defaults to hiding the side tools, while exiting it reveals competing Search, Files, Context, Graph, and Insights surfaces.
5. A question retrieves up to 20 chunks, reads every pinned file again, collects Git context, adds prior chat history, then streams from Ollama or OpenRouter.
6. Citations shown beneath the answer are the full retrieved result set, not answer-span attribution. A user can open a file, pin it, branch/export a chat, or apply a detected JSON whole-file proposal.

Friction begins before the first useful answer: initial indexing depends on Ollama even when OpenRouter is selected; indexing state is not recoverable or trustworthy after interruption; the progress ratio mixes files with chunks; and the core workspace is surrounded by model/persona/timeline/graph/analytics controls that imply capabilities deeper than their implementations.

Failure states are mostly console errors or generic toast/chat messages. Missing folders, dead Ollama, removed models, corrupt histories, watcher failure, and updater failure have no durable recovery surface. Reindexing navigates back toward onboarding rather than behaving like workspace maintenance.

## E. Feature Matrix

Status is the audit classification requested; value/cost are relative (`High`, `Medium`, `Low`).

| Feature | Status | Product Value | UX Cost | Technical Cost | Recommendation |
|---|---|---:|---:|---:|---|
| Workspace selection/onboarding | CORE | High | Medium | Medium | Keep; make model/index prerequisites and recovery explicit. |
| Workspace registry/restoration | CORE / INCOMPLETE | High | Low | Medium | Validate paths and version persistence; scope data to workspace. |
| Multiple active workspaces | EXPERIMENTAL / BROKEN | Medium | High | High | Remove from 1.0 or redesign intentionally after single-workspace correctness. |
| Folder crawling/indexing | CORE / BROKEN | High | Medium | High | Keep; make ingestion transactional and observable. |
| Incremental manifests | CORE / BROKEN | High | Low | High | Rewrite commit ordering and collision handling. |
| File watcher | VALUABLE / INCOMPLETE | High | Low | High | Keep after deduplication, retry, and targeted updates. |
| Semantic chunking | CORE / INCOMPLETE | High | Low | Medium | Keep; expand language correctness and test overlap. |
| Ollama embeddings | CORE | High | Medium | Medium | Keep; distinguish embedding models from chat models. |
| Semantic retrieval | CORE / INCOMPLETE | High | Low | High | Keep and improve ranking, thresholds, diversity, and budgets. |
| Lexical retrieval | VALUABLE / INCOMPLETE | High | Low | Medium | Replace `ILIKE` merge with real indexed lexical scoring. |
| Graph relationships | EXPERIMENTAL / BROKEN | Low | High | High | Remove unless a measured retrieval use case justifies rebuild. |
| Chat and streaming | CORE / INCOMPLETE | High | Low | High | Keep; fix history, framing, cancellation, and provider errors. |
| Citations/evidence | CORE / INCOMPLETE | High | Low | Medium | Keep; cite used evidence with correct 1-based locations. |
| File search | CORE / INCOMPLETE | High | Low | Medium | Merge into a unified Find/Ask surface; improve ranking. |
| File tree | VALUABLE | High | Medium | Medium | Keep as contextual evidence navigation, virtualize for scale. |
| File preview/highlighting | VALUABLE / INCOMPLETE | High | Low | Medium | Keep; align supported types, line numbers, and accessibility. |
| Pinned/manual context | CORE / RISKY | High | Medium | Medium | Keep with workspace boundary, size/token budgets, and visibility. |
| Chat history | VALUABLE / INCOMPLETE | High | Medium | Medium | Keep, workspace-scope it, validate/migrate persistence. |
| Chat export/branch | NICHE | Medium | Medium | Low | De-emphasize; merge branch into history actions. |
| Ollama support/status | CORE / INCOMPLETE | High | Medium | Medium | Keep; honor custom host everywhere and add recovery states. |
| OpenRouter | VALUABLE / RISKY | Medium | High | High | Keep opt-in only, with exact data-transfer consent and redaction. |
| Model selector | VALUABLE / CONFUSING | Medium | High | Medium | Separate chat and embedding models; move routine choice out of composer. |
| Multi-model routing | EXPERIMENTAL | Low | High | High | Reconsider until one local and one cloud path are dependable. |
| Personas | REDUNDANT / BROKEN | Low | Medium | Medium | Remove or merge into a later, tested instruction-profile concept. |
| Git awareness | VALUABLE / RISKY | Medium | Low | Medium | Keep de-emphasized and opt-in for cloud; constrain repo discovery. |
| Timeline intelligence | NICHE | Low | Medium | Medium | Merge with Git context or remove. |
| Secret Shield | VALUABLE / INCOMPLETE | High | Medium | Medium | Retain only after scanning the complete outbound payload. |
| Image attachments/vision | BROKEN | Medium | Medium | Medium | Remove UI until a provider-capability path exists. |
| Proposed code actions/diffs | EXPERIMENTAL / RISKY | Medium | High | High | Remove from 1.0 or rebuild with workspace sandbox and true patches. |
| Arbitrary shell execution | DEAD / RISKY | Low | None currently | High | Remove command/API until a designed, permissioned agent workflow exists. |
| Architecture graph | EXPERIMENTAL / BROKEN | Low | High | High | Remove primary surface; reconsider only with unique IDs and use case. |
| Analytics dashboard | REDUNDANT / MISLEADING | Low | High | Medium | Remove synthetic metrics; replace only with honest index health. |
| Command palette | VALUABLE / INCOMPLETE | Medium | Low | Medium | Keep later; first establish stable actions and accessibility. |
| Overlay chat/global shortcuts | NICHE / BROKEN | Medium | High | High | Remove from 1.0 or rebuild after core chat stabilizes. |
| Zen mode | REDUNDANT | Low | Medium | Low | Merge into normal collapsible layout behavior. |
| Themes | VALUABLE | Low | Low | Low | Keep system/light/dark; do not prioritize. |
| Accent customization | NICHE | Low | Medium | Low | De-emphasize or remove from 1.0 settings. |
| Internationalization | INCOMPLETE | Medium future | Medium | Medium | Pause infrastructure until actual locales and full coverage are funded. |
| Settings | CORE / OVERLOADED | High | High | Medium | Reorganize around Models & Privacy, Indexing, General, Advanced. |
| Storage optimize/compress | BROKEN / DEAD | Low | Medium | Low | Remove simulated controls immediately. |
| Updater | VALUABLE / BROKEN | High | Low | High | Fix signing/configuration before shipping; fail visibly and safely. |
| Installer scripts | VALUABLE / INCOMPLETE | Medium | Low | Medium | Align claims, supported platforms, and actual build behavior. |
| PDF indexing | VALUABLE / INCOMPLETE | Medium | Low | Medium | Keep with extraction quality/size tests and clear limitations. |
| DOCX/document indexing | INCOMPLETE | Medium | Low | Medium | Do not claim support; choose deliberate 1.x scope. |
| Web search | DEAD / BROKEN | Low | Medium | Medium | Remove frontend/backend settings until intentionally integrated. |
| Index statistics | VALUABLE / INCOMPLETE | Medium | Low | Medium | Keep only factual health/coverage data; eliminate fabricated values. |
| Update/release website | VALUABLE | Medium | Low | Medium | Keep, but source versions/releases from one authority. |
| Toast/error normalization | VALUABLE / INCOMPLETE | Medium | Low | Low | Complete one consistent error taxonomy during refactor. |
| Legacy local setup sidecar | DEAD / UNUSED | None | None | Medium | Remove after confirming no supported migration requires it. |

## F. Confirmed Bugs

1. **Index manifests can claim data that was never embedded.** `commands.rs:177` deletes old rows; `commands.rs:237` calls `mark_indexed`; `commands.rs:271` saves the manifest before embedding begins later in the function. An embedding/network/process failure leaves old content deleted and the new file hash recorded, so the next run skips it. **Impact:** silent stale/missing knowledge. **Response:** stage chunks, embed/write successfully, then atomically update manifest and remove obsolete rows.
2. **Unicode input can panic Rust commands.** `commands.rs:493`, `:567`, and the history truncation near `:617` slice UTF-8 strings by byte offsets. A multibyte character crossing 6,000/8,000/500 bytes panics. **Response:** truncate on character boundaries or token budget.
3. **The current conversation omits an earlier real message.** `WorkspaceLayout.tsx:495-496` builds history from the pre-update `activeSession` closure and then calls `.slice(0, -1)` to remove a placeholder that is not in that closure. **Impact:** every follow-up loses the most recent stored turn from model context.
4. **Stop generation is nonfunctional.** `WorkspaceLayout.tsx:223` creates `abortRef`; `:400` aborts it, but no request assigns an `AbortController` or cancellation handle. The UI reports “Generation stopped” while backend streaming continues.
5. **Personas, web search, and images are ignored.** Frontend `api.ts:107-116` and `WorkspaceLayout.tsx:533-537` send these fields; Rust `ChatRequest` (`commands.rs:388-410`) has no corresponding fields. Unknown fields are discarded.
6. **Overlay retrieval uses the wrong workspace key.** `OverlayChat.tsx:27-35` sends random `Workspace.id` values; indexed rows and the main workspace send folder paths. Its filter therefore excludes intended chunks. It also omits configured provider/API key/host/embedding model and defaults toward Ollama.
7. **OpenRouter onboarding can select a chat model as the embedding model.** `LandingScreen` fills its model choice from OpenRouter, but indexing calls Ollama embeddings using that selected value. Cloud-only onboarding therefore cannot work, and many OpenRouter model IDs are invalid at Ollama's embedding endpoint.
8. **Custom Ollama host is inconsistently ignored.** Chat/search can receive `ollamaHost`, while initial model/status discovery and indexing use hard-coded `127.0.0.1:11434`. A configured remote/local alternative host cannot complete the full workflow.
9. **Citation/file locations are off by one.** Parser metadata uses zero-based tree-sitter/fallback line indices, while the viewer renders lines one-based. Line zero is additionally suppressed by truthiness checks. Citation navigation can display or scroll to the wrong line.
10. **Ollama streaming drops split JSON records.** `llm.rs` parses newline-delimited JSON independently per network bytes chunk without carrying an incomplete line to the next chunk. TCP/chunk boundaries are not message boundaries; split events are silently lost.
11. **Settings exposes controls with no behavior.** `contextSlots` is edited in `SettingsModal.tsx:291-297` but retrieval stays hard-coded; “Optimize/Compress” uses timers to simulate completion around `SettingsModal.tsx:557-573` without backend work. The landing settings reindex callback is also a no-op while the control remains visible.
12. **Analytics reports fabricated precision.** `AnalyticsDashboard.tsx:35` hard-codes “180ms”; `vectorstore.rs:761` reports 100% knowledge coverage whenever any file exists; velocity bars are synthetic. These are presented as product measurements.
13. **Updater verification cannot succeed as configured.** `tauri.conf.json:67` contains `YOUR_PUBKEY_HERE`. Update errors are reduced to console warnings, so users receive neither updates nor an actionable repair path.
14. **Relationship graph accumulates stale/duplicate edges.** Reindexing appends relationships, while `delete_by_filepath` removes chunk rows but not corresponding edge rows. File deletion/rename leaves graph data behind.
15. **Whole-file proposal application can report a false success.** `apply_diff` performs unrestricted `current.replace(original, new)` and writes the result. If `original` is absent, the unchanged content is still written and the UI treats the action as applied. All occurrences are replaced when present.
16. **Watcher creation failure can prevent retry.** `watcher.rs` registers the workspace in the watcher map before watcher construction/watch success; the spawned task can return while the key remains. Later starts see an existing watcher.
17. **Workspace removal or disappearance leaves retrievable data.** Removing the frontend registration does not purge LanceDB/manifests. A missing folder can still be opened and stale indexed chunks can answer questions.

## G. Risks / Suspected Bugs

- **INFERENCE — concurrent indexing corruption:** every watcher burst can start a full indexing job; there is no per-workspace lock/cancel/dedup. Concurrent jobs can race deletes, writes, and manifest saves.
- **INFERENCE — manifest collision:** `manifest.rs` lowercases, replaces non-alphanumerics, collapses, and truncates paths to 80 characters. Distinct long/case-sensitive paths can share a manifest.
- **INFERENCE — progress completion race:** the frontend subscribes after `start_indexing` returns a job ID, while backend work is already spawned. Very small jobs may emit completion before the listener exists; there is no job-status query.
- **INFERENCE — large-repository memory/startup pressure:** crawling loads all eligible file contents before hash filtering; file tree and graph endpoints fully materialize data; a 10 MB per-file ceiling does not cap repository total.
- **INFERENCE — cross-workspace disclosure:** chats and manual-context paths are global, not workspace-scoped. Switching workspaces can expose prior pinned paths/history to another workspace request.
- **INFERENCE — wrong Git repository:** `Repository::discover` may attach a selected subfolder to an ancestor repository and send unrelated status/commit metadata.
- **INFERENCE — binary/unsupported preview confusion:** file tree includes types crawler will not index; `read_to_string` behavior makes binary/non-UTF-8 inspection fail without a clear unsupported state.
- **INFERENCE — hidden configuration blind spot:** crawler rejects all names beginning with `.`, so the declared `.env` extension is unreachable and hidden source/config files are never indexed.
- **INFERENCE — long/Unicode/Windows path edge cases:** no test covers path length, UNC paths, separators, case folding, or Unicode manifest identifiers.
- **INFERENCE — model-dimension fragmentation:** changing embedding models produces separate dimension tables but manifest eligibility is model-string based; invalid/removed models have only request-time errors and no migration UX.
- **INFERENCE — query-cache staleness:** the global LRU cache is not visibly invalidated on index changes, so prior retrieval results may survive file updates.
- **INFERENCE — event/listener leaks:** overlay and some event subscriptions do not consistently retain/call unlisten handles across remounts.
- **INFERENCE — OpenRouter stream lifecycle:** `[DONE]` exits only the inner parse loop, so the transport can continue being polled; malformed records are silently ignored.

## H. Technical Debt

### Priority 0: correctness and trust

- Non-transactional indexing/manifest protocol and concurrent watcher jobs.
- Unbounded arbitrary filesystem/shell IPC and incomplete outbound secret inspection.
- Broken UI/backend contracts and false-success controls.
- Plaintext API keys in frontend-accessible localStorage.
- No cancellation, robust stream framing, or provider timeout policy.

### Priority 1: architecture

- `commands.rs` and `WorkspaceLayout.tsx` are god modules with mixed ownership.
- Persistence has no schema/version/validation and chats are not workspace entities.
- Provider, embedding, retrieval, prompt construction, and privacy policy are entangled.
- Workspace identity alternates between UUID and path.
- Index data, manifest state, relationship data, and file watcher lifecycle lack one transaction/ownership boundary.

### Priority 2: maintainability/performance

- Duplicate/ad hoc dialogs, icons, styling, error handling, and polling.
- Whole-tree/full-table/full-content operations where incremental/virtualized APIs are needed.
- Sparse tests around all critical paths.
- Very large frontend bundle and expensive syntax/graph dependencies.
- Docs and release metadata have no single source of truth.

## I. Dead / Redundant Code Candidates

These are candidates, not deletion instructions.

| Candidate | Evidence | Recommendation |
|---|---|---|
| `src/components/SetupModal.tsx`, `src/lib/setup.ts` | Legacy sidecar flow references local port 47291; no supported route from current app. | Confirm migration history, then remove. |
| `src/components/Input.tsx` | No production import found. | Remove or adopt one input primitive. |
| `fetchOllamaStatus` compatibility wrapper | Newer status path is used; legacy wrapper has no caller. | Remove after API inventory. |
| `executeShellCommand` frontend wrapper / Rust command | No frontend caller; backend remains exposed. | Remove exposure until agent design exists. |
| `web_search` command and client | Settings/DTO exist, but no frontend invoke path; chat ignores the fields. | Remove or implement later behind a deliberate feature. |
| Persona prompt catalog | `getPersona` is imported, but selected prompt is never added to the request. | Remove from primary UI. |
| `contextSlots` | Written/read by settings UI; never controls retrieval. | Remove until backed by a context-budget model. |
| Indexing jobs map | Jobs are written but no status/query/cleanup command consumes them. | Replace with an observable job service. |
| `parentText` vector metadata | Always stored as `None`; no retrieval consumer. | Remove or implement genuine hierarchy. |
| Parser identifier collection | Collected but not used to produce retrieval behavior. | Remove or make relationship extraction explicit/tested. |
| Relationship reset/legacy paths | Reset is dead/annotated and edges are not lifecycle-managed. | Remove with graph feature or redesign storage. |
| Vite/React template assets and desktop README | `vite.svg`, `react.svg`, and template instructions do not describe Atlas. | Remove during documentation cleanup. |
| Tracked Cargo diagnostic text artifacts | Build diagnostics are repository artifacts rather than source/docs. | Stop tracking; ensure diagnostics output is ignored. |
| `src-tauri/target-codex/` | Untracked build directory is not covered by `target/` ignore and triggers Tauri watch restarts. | Add the exact generated-output policy after preserving any user data. |
| `zustand`, `@types/uuid` | No Zustand imports; `@types/uuid` is deprecated/redundant with bundled types. | Remove in dependency cleanup. |
| Tauri JS/Rust fs and os plugins | No frontend use found; capabilities remain enabled. | Remove dependencies/capabilities unless a real use is retained. |
| Fake analytics and storage optimization | Hard-coded/synthetic values and timer-only actions. | Remove rather than polish. |

## J. RAG Quality Assessment

### Exact pipeline

1. **Crawl:** `crawler.rs` walks recursively, skips hidden names and default ignored directories, accepts a fixed extension list, rejects files over 10 MB, reads text synchronously, and extracts PDF text in a blocking task.
2. **Incremental decision:** `manifest.rs` hashes content and compares path/hash/model. Despite this, all eligible file contents are loaded before deciding what changed.
3. **Chunk:** `parser.rs` uses tree-sitter for TypeScript/JavaScript, Rust, and Python declarations. Other files use 50-line chunks with 10-line overlap. Recursive syntax captures can create overlapping parent/member chunks. TSX is parsed with the TypeScript grammar rather than a distinct TSX grammar.
4. **Metadata:** path, zero-based start/end line, language/kind/name, workspace folder path, and limited relationships. `parentText` is empty.
5. **Embed:** batches of eight, four concurrent requests, using Ollama `/api/embeddings`. Initial indexing is hard-coded to localhost and conflates the chosen model with an embedding model.
6. **Store:** LanceDB tables are partitioned by vector dimension; updates delete all old chunks for a file then add new records. No vector index/optimization creation was found. Relationship rows are appended separately.
7. **Retrieve:** chat embeds the query, vector-searches up to 20, extracts up to 20 query words longer than three characters excluding a small stop list, executes SQL `ILIKE` OR conditions, labels lexical matches with distance 0, prepends them, and truncates to 20. File search uses vector similarity only (top 10).
8. **Construct context:** all returned chunk text is concatenated, followed by each manually pinned file truncated to 8,000 bytes, Git context, and chat history truncated per turn. There is no tokenizer, global context budget, deduplication, diversity policy, score threshold, or provider-window accounting.
9. **Generate:** Ollama or OpenRouter streams a response.
10. **Cite:** UI attaches the complete retrieved result list to the answer. Citations are retrieval provenance, not proof that the model used a passage for a claim.

### Assessment

**FACT:** This is not BM25, RRF, HyDE, reranking, or GraphRAG. Lexical results receive artificial perfect distance and dominate semantic results. SQL result order is not an explicit relevance ranking. Common symbols can flood the top 20, overlapping semantic chunks can duplicate context, and no minimum similarity suppresses irrelevant context.

**FACT:** Incremental ingestion correctness is the largest quality issue. Retrieval cannot recover content that a failed job deleted and then marked current. Watcher-triggered full runs and stale graph edges make changing workspaces particularly fragile.

**FACT:** Context construction can exceed a model's useful or maximum window; `contextSlots` does not constrain it. Pinned files are read by arbitrary path and do not share a budget with retrieved evidence or history.

**INFERENCE:** Answer hallucination will often be blamed on the model when causes are stale/missing chunks, exact-match flooding, duplicate chunks, poor chunk boundaries, or prompt truncation at the provider.

### Highest-value retrieval improvements

1. Make indexing transactional, idempotent, cancellable, per-workspace serialized, and status-queryable.
2. Separate and validate embedding-model configuration; record model identity and dimensions as an index contract.
3. Add evaluation fixtures before changing ranking: code navigation, docs Q&A, renamed/deleted files, multi-language symbols, and irrelevant-query rejection.
4. Implement genuine hybrid scoring (indexed lexical score plus vector score), deterministic fusion, score thresholds, path/type filters, deduplication, and diversity.
5. Introduce token-aware context selection and explicit evidence budgets for retrieval, manual context, Git, and history.
6. Normalize 1-based source ranges and create citations only for evidence actually supplied/associated with answer claims.
7. Improve chunking by language and document structure, avoid nested duplicates, preserve symbol/path metadata, and decide whether parent-child retrieval offers measured value.
8. Replace whole-repository incremental scans with metadata-first discovery and changed-file reads; create/maintain the appropriate Lance index only after measuring corpus scale.

## K. Security & Privacy Assessment

### Data that can leave the machine

- **OpenRouter:** system prompt; retrieved workspace chunks; manual-file content; user query; previous chat turns; Git branch, changed/untracked filenames, recent commit authors/messages/stats, and diff summary. This is the main workspace-data egress path.
- **Ollama:** prompts and embeddings go to the configured/hard-coded Ollama HTTP host. It is normally localhost, but a custom host can be remote and is not framed as a cloud disclosure.
- **Tavily/Serper:** backend clients exist and would transmit queries/API keys, although current chat does not call them.
- **GitHub:** updater checks and website release lookup send normal network metadata, not workspace content.
- No analytics/telemetry SDK or workspace telemetry transmission was found.

**FACT:** Secret Shield scans only the typed query before cloud send. It does not scan the retrieved source, pinned files, Git context, system prompt, or history that form the larger and more sensitive payload. The product's “local-first” promise is therefore only true for an Ollama-only path; OpenRouter is an explicit architectural exception that documentation understates.

**FACT:** OpenRouter and web-search API keys are stored in plaintext JSON in frontend localStorage (`src/lib/settings.ts:35-47`) and sent through IPC per request. Any frontend script execution has access. Use the OS credential store or a Rust-owned secret abstraction and never return keys to React.

**FACT:** `tauri.conf.json:38` sets CSP to `null`. Main capability enables shell spawn/kill/open and execution of `code`; custom Rust commands additionally allow arbitrary executable/arguments/current directory and arbitrary file reads/writes without ensuring paths belong to an opened workspace. The custom commands bypass the narrower plugin-shell allowlist.

**FACT:** `apply_diff` can create directories/files anywhere available to the process and performs no canonicalization, symlink, workspace-boundary, or time-of-check validation. `read_file` has the same broad scope. A human click gates proposed edits in the UI, but the IPC itself does not enforce that policy.

**FACT:** debug/error logging includes paths/statuses but no deliberate request-body/API-key logging was found. LanceDB/manifests/chats are persistent local data and are not encrypted. Workspace removal does not delete them.

**RECOMMENDATION:** Establish a Rust-owned outbound-payload builder that produces a visible disclosure summary, scans/redacts the complete payload, requires explicit cloud opt-in per workspace/provider, and is covered by tests. Store secrets in OS credentials. Deny arbitrary shell/filesystem IPC by default, canonicalize and authorize workspace paths in the backend, define a CSP, and minimize Tauri capabilities/plugins.

## L. UI Architecture Assessment

### Oversized/problematic modules

| Module | Approx. lines | Mixed responsibilities |
|---|---:|---|
| `WorkspaceLayout.tsx` | 1,261 | Navigation, sessions, streaming, model polling, tools, files, search, Git, timeline, watcher, context, modals, composer. |
| `SettingsModal.tsx` | 600 | Four settings domains, provider credentials, model/index operations, theme, fake storage operations, focus behavior. |
| `LandingScreen.tsx` | 388 | Workspace CRUD, provider discovery, model selection, index event lifecycle, progress, onboarding layout. |
| `src-tauri/src/commands.rs` | 941 | Index transaction, retrieval, prompt/privacy/provider orchestration, filesystem, shell, mutation. |
| `src-tauri/src/vectorstore.rs` | 895 | Schema/write/search/hybrid/graph/stats/cache concerns. |

`WorkspaceLayout` relies on deeply nested conditional JSX for zen mode, tool tabs, chat empty/generating states, file viewer, secret modal, and actions. This creates implicit dependencies such as “current primary workspace,” closure timing in chat updates, and watcher/model settings that are difficult to isolate or test.

Styling is mostly ad hoc Tailwind strings plus a 424-line global CSS file. Similar overlay/dialog/icon-button patterns are implemented independently. `react-resizable-panels` is present, but layout state/behavior remains strongly coupled to one component. Error normalization is being introduced in the dirty tree, yet console errors, toasts, inline chat failures, and silent fallbacks still coexist.

### Accessibility findings

- `SettingsModal` is comparatively strong: dialog semantics, Escape handling, and focus trap exist.
- `CommandPalette`, file viewer, and Secret Shield overlays lack consistent `role="dialog"`, `aria-modal`, labelling, focus capture/restore, and keyboard containment.
- Several icon-only controls have no accessible name; image previews lack meaningful `alt` treatment.
- File-tree disclosure does not consistently expose `aria-expanded`/tree semantics.
- Workspace rows emulate keyboard-clickable containers while nesting a delete button, creating confusing interactive structure.
- Hover-only rename/delete actions and repeated `focus:outline-none` patterns reduce keyboard discoverability/visibility.

## M. UX / Information Architecture Assessment

Atlas currently feels like an incoherent combination of chat app, code browser, developer dashboard, graph explorer, and model playground. The chat is visually central, but the product asks users to understand embedding models, chat providers, personas, context, timeline, graphs, analytics, multiple workspaces, and display modes before it has proven the basic “answer from my workspace” loop.

Key friction:

- “Index,” “reindex,” embedding model, chat model, provider health, and workspace readiness are not presented as one understandable lifecycle.
- Search, Files, Context, Graph, and Insights compete as peer navigation even though only the first three support the core task.
- Model/persona/image/timeline controls receive composer prominence despite being advanced, broken, or marginal.
- Citations do not communicate confidence, selection rationale, index freshness, or whether a passage actually supported a claim.
- Empty/loading/failure states do not distinguish no workspace, no index, stale index, unavailable Ollama, invalid model, provider failure, or zero relevant evidence.
- Settings exposes implementation knobs and fictional maintenance actions while essential privacy/index health remains obscure.
- Zen mode hides complexity rather than resolving the hierarchy; it is the default, so users alternate between an empty chat-like surface and a tool-heavy shell.

**RECOMMENDATION:** Atlas should feel like a calm, evidence-first workspace research tool for developers and technical documents. Chat is an interaction mode, not the entire identity; files and citations are the evidence layer; indexing health is persistent system status; models are infrastructure; graphs/analytics are not top-level destinations.

## N. Feature Reduction Recommendations

### KEEP AND IMPROVE

- Workspace open/restore and a trustworthy index lifecycle.
- Local Ollama embeddings and chat, with clear embedding/chat model separation.
- Evidence-grounded Ask and semantic/lexical Find.
- File tree, file preview, source navigation, and accurate citations.
- Manual context with a visible, bounded context budget.
- Workspace-scoped chat history and export.
- Reliable changed-file handling/watchers and factual index health.
- Optional PDF/text/code ingestion with honest supported-format messaging.

### KEEP BUT DE-EMPHASIZE

- OpenRouter, only as explicit opt-in cloud execution with payload disclosure.
- Git context, opt-in and summarized behind the evidence pane.
- Model choice and provider diagnostics in status/settings rather than every message.
- Command palette after the action model stabilizes.
- Theme (system/light/dark), updater, chat branching, and secondary export actions.
- Multiple workspaces as a launcher/history concept, not simultaneous retrieval in 1.0.

### REMOVE / MERGE / RECONSIDER

- Remove personas until instruction profiles solve a validated use case end to end.
- Remove image attachment and web-search UI until actually supported.
- Remove synthetic analytics; merge honest counts/freshness/errors into index health.
- Remove architecture graph/timeline from primary navigation; reconsider only with measured value.
- Remove overlay chat for 1.0; it duplicates chat with a broken identity/provider path.
- Merge zen mode into ordinary panel collapsing and sensible defaults.
- Remove accent customization and pause incomplete i18n from primary settings.
- Remove fake optimize/compress controls.
- Remove arbitrary shell execution and current diff application until a sandboxed action system exists.
- Remove the legacy local sidecar setup flow and unused wrappers after validation.
- Reconsider simultaneous multi-workspace RAG and multi-model routing; both multiply ambiguity before the single-workspace contract is reliable.

## O. Recommended Atlas 1.0 Product Model

**One-sentence definition:** **Atlas 1.0 is a local-first workspace intelligence desktop app that indexes one codebase or document set, answers grounded questions with inspectable evidence, and makes every cloud transfer explicit and opt-in.**

### Product hierarchy

1. **Launcher:** recent workspaces, path/availability, last indexed state, and one Open Workspace action. Provider setup is a prerequisite check, not the main onboarding choice.
2. **Workspace shell:** one current workspace, with persistent but quiet index/model/privacy status.
3. **Primary surface — Ask/Find:** a unified query entry that can answer from evidence or show ranked files/passages. Conversation lives here without resembling a generic empty chat product.
4. **Evidence pane:** citations, selected source, file tree/search, and manual-context basket share one contextual side surface. Opening evidence should never destroy the conversation.
5. **History:** workspace-scoped sessions in a compact rail/drawer. Multiple workspace switching remains in the launcher.
6. **Advanced area:** index diagnostics, provider details, Git context, exports, and future experiments live outside primary navigation.

Model selection should be a workspace/provider status control, not a dominant composer control. Settings should be a full, navigable surface or large sheet grouped into General, Models & Privacy, Indexing, and Advanced—not a long modal with unrelated operations. Dialogs should be reserved for confirmation, credentials, and focused short tasks. Graph, analytics, persona, timeline, web, vision, accent, and agent actions should disappear from the primary UI.

## P. Proposed Refactor Boundaries

No refactor should begin until P0 tests capture current/fixed behavior.

### Rust

- **WorkspaceRegistry:** canonical workspace ID/path, availability, settings, purge semantics.
- **IndexService:** discovery, change plan, staged embedding/write, atomic commit, progress/status, cancellation, watcher serialization.
- **DocumentPipeline:** format adapters, normalized chunks/ranges, metadata, content limits.
- **EmbeddingProvider:** model discovery/validation, dimensions, timeouts, batching, health.
- **RetrievalEngine:** lexical/vector candidates, fusion, filters, dedup/diversity, token budget, evidence result type.
- **GenerationProvider:** Ollama/OpenRouter streaming with shared framing, typed errors, timeout, cancellation.
- **OutboundPolicy:** payload construction, complete secret scan/redaction, consent/audit metadata.
- **Storage repositories:** Lance chunks/index metadata and durable workspace/chat settings with migrations; graph separate or removed.
- **IPC layer:** thin, typed, workspace-authorized commands; no arbitrary filesystem/shell primitives.

### Frontend

- **App shell/router:** launcher versus one workspace; window-specific overlay code removed or isolated.
- **Workspace controller/store:** canonical workspace status, index job, provider health, and session identity. Choose a reducer/store based on behavior, not the already-unused Zustand dependency.
- **Chat controller:** immutable session updates, request snapshot, stream/cancel lifecycle, errors, evidence.
- **Evidence domain:** Find results, citations, file tree/viewer, and manual context.
- **Settings schema:** validated/versioned public preferences; secrets remain Rust-owned.
- **UI primitives:** modal/popover/menu/button/toast/focus behavior and accessible resizable layout.
- Break `WorkspaceLayout`, `SettingsModal`, and `LandingScreen` along these boundaries; avoid merely moving JSX into many state-coupled files.

## Q. Testing Strategy

Current automated coverage is four Rust Secret Shield unit tests plus two website test files/four tests (release utilities and one homepage axe check). No desktop frontend unit/component/integration/E2E test suite was found; no indexing, retrieval, persistence, model, IPC, watcher, or updater tests exist.

### Required before major refactoring

1. **Index transaction integration tests:** initial, unchanged, modified, failed embedding, interrupted run, retry, deletion, rename, concurrent watcher burst, and manifest corruption.
2. **Retrieval golden tests:** lexical versus semantic relevance, duplicate suppression, unrelated-query rejection, path/language filters, citation lines, and context-token budget.
3. **Corpus fixtures:** TypeScript/TSX, Rust, Python, Markdown, PDF, Unicode filenames/content, non-UTF-8/binary, hidden paths, long paths, Git/non-Git, and huge-file boundaries.
4. **Provider contract tests:** unavailable/recovering Ollama, missing/removed embedding model, invalid OpenRouter key, timeout, malformed/split stream records, mid-stream failure, cancellation, and model switching.
5. **Privacy tests:** snapshot the exact OpenRouter payload; verify full-payload secret blocking/redaction; ensure local mode makes no cloud workspace request; verify API keys never reach localStorage/logs.
6. **Workspace persistence tests:** corrupt/old local state migration, missing folder, remove/purge semantics, workspace-scoped chats/manual files, and multi-workspace isolation.
7. **IPC security tests:** canonicalization, symlink escape, traversal, outside-workspace reads/writes, unauthorized shell, and proposed-change conflict/no-match.
8. **React component tests:** onboarding prerequisites, index status/recovery, chat history ordering, cancellation, evidence navigation, error states, keyboard/focus/dialog accessibility.
9. **Tauri E2E smoke:** fresh launch -> open fixture -> index -> ask -> open citation -> modify/delete file -> refreshed answer; local and opt-in cloud variants.
10. **Release tests:** version consistency, signed updater fixture, packaged launch on each supported OS, upgrade/persistence compatibility.

CI should run frozen dependency installs, desktop lint/typecheck/build, Rust fmt/clippy/test, the retrieval/index integration suite, website checks, and a smaller packaged smoke gate. Coverage targets are less important than owning the high-risk workflows above.

## R. Dependency Findings

### npm/frontend

- **FACT:** root `turbo` is specified as `latest`, weakening reproducibility even with a lockfile. Pin an intentional range/version.
- **FACT:** `zustand` has no imports. `@types/uuid` is deprecated and unnecessary because modern `uuid` ships types. `uuid` itself overlaps browser `crypto.randomUUID`, already used in the code.
- **FACT:** `@tauri-apps/plugin-fs` and `plugin-os` have no frontend callers found; corresponding Rust plugins/capabilities expand footprint and permissions.
- **FACT:** `reactflow` exists solely for the graph candidate; `react-syntax-highlighter` and its language payload contribute to the 1.35 MB main JS bundle. Reassess after product reduction; do not micro-optimize first.
- **FACT:** i18next/react-i18next/browser detection serve one English resource and only a small subset of strings. Either fund complete localization or reduce dormant infrastructure.
- **FACT:** the website is not part of pnpm/Turbo and uses npm separately. This can be valid, but root scripts do not validate the complete repository.
- **FACT:** newer major versions exist for several packages (including Vite, TypeScript, ESLint, Next, i18next, React Flow-related ecosystem). This audit does **not** recommend blind upgrades; first remove unused feature dependencies and establish tests.

### Rust

- **FACT:** LanceDB 0.15/Arrow 53 is far behind current major/minor lines and pulls a heavy Lance/DataFusion/Tantivy/object-store/AWS graph. Fresh test compilation took about four minutes.
- **FACT:** dependency tree includes duplicate generations such as reqwest 0.12 direct and 0.13 transitive, object_store 0.10/0.11, and dirs 5/6.
- **FACT:** direct `notify` appears unnecessary because watcher use is through `notify-debouncer-full`; validate then remove the direct declaration.
- `git2`, tree-sitter grammars, PDF extraction, LanceDB, and Tauri are appropriate to retained core capabilities, but upgrades are migration projects requiring fixture tests, not routine housekeeping.
- If graph/web/shell features are removed, their dependencies and transitive costs should be measured again. Dependency reduction should follow the product decision, not precede it.

## S. Documentation Drift

| Documentation claim | Code/repository reality |
|---|---|
| Root README version badge 0.10.0; audit request 0.9.2 | Current desktop/Cargo/Tauri manifests say 1.0.1; HEAD manifests previously differed again. No single authoritative version. |
| README/tech stack: React 18 | `apps/desktop/package.json` uses React 19.2. |
| README: “Your code never leaves your machine” | OpenRouter requests include retrieved code, pinned files, Git data, and history. |
| Architecture: 512 B child / 2 KB parent chunks | Actual chunks are syntax declarations or 50 lines/10 overlap; `parentText` is empty. |
| Architecture/changelog: BM25 + RRF + HyDE + GraphRAG | Code uses vector search plus SQL `ILIKE` prepending; no HyDE/reranker; graph is not used for retrieval. |
| PRD: DOCX ingestion | Crawler has no DOCX support. |
| Changelog: vision, web, personas | Frontend sends fields Rust ignores. |
| Changelog: storage compression/optimization | Settings actions are timers only. |
| Changelog: Brave/Tavily web providers | Backend implements Tavily/Serper; chat calls neither. |
| TODO: signed/notarized 1.0 launch complete | Updater pubkey is a placeholder; workflow/config show no macOS packaging/notarization evidence. |
| Install/build docs imply monorepo/Tauri build | Root Turbo builds frontend packages; installer scripts primarily build frontend then run dev. Website is excluded. |
| README links `BUILD.md` | The linked file is absent from the tracked repository. |
| Tech stack: Zustand state management | Dependency exists but frontend uses local component state/localStorage. |
| Benchmarks: RRF search, 60 FPS, 300-file Atlas repo | No benchmark harness/evidence supports these statements; implementation does not contain RRF. |
| Desktop README | Still generic Vite template instructions. |

Planning documents remain useful historical intent, especially the product principles and desired local-first workflow, but must be labelled archival. README/architecture/security claims need to describe shipped behavior, not planned behavior. Generate versions and supported-platform tables from one release source where possible.

## T. Prioritized Roadmap

### P0 - Fix before redesign

1. Freeze a reproducible baseline: reconcile version, dirty-tree changes, Node/pnpm/Rust requirements, and generated-artifact ignores.
2. Add index transaction/integration tests; fix delete-before-embed, manifest commit order, per-workspace serialization, cancellation/status, stale edges/cache, and retry.
3. Define/enforce the privacy boundary: complete outbound-payload scanning/disclosure, OS-owned secrets, explicit cloud opt-in, no misleading local-only claim.
4. Remove or disable unsafe arbitrary shell/file mutation IPC; canonicalize and authorize all workspace paths; add CSP and minimize capabilities.
5. Fix chat history, UTF-8 slicing, source ranges, stream framing, stop/cancel, provider timeouts/errors, and custom Ollama host/model contracts.
6. Hide or remove false controls now: personas, vision, web search, context scope, optimize/compress, synthetic analytics, broken overlay, and invalid landing reindex.
7. Configure and test signed updater/release paths or disable updater until valid.

### P1 - Product simplification

1. Commit to one-workspace-at-a-time Atlas 1.0 and workspace-scope history/context/index ownership.
2. Consolidate Search, Files, Context, and citations into Ask/Find plus one evidence pane.
3. Remove graph/analytics/timeline from primary navigation; evaluate deletion based on measured use.
4. Move models/privacy/indexing into status and reorganized settings; de-emphasize themes/export/branch/Git.
5. Write the honest product definition and supported-format/provider contract before visual design.

### P2 - UI/UX refresh

1. Build launcher, workspace shell, Ask/Find surface, evidence pane, workspace history, and explicit index/error states.
2. Establish accessible primitives and keyboard/focus behavior before rebuilding dialogs/menus.
3. Make citations, manual context, index freshness, local/cloud state, and active provider consistently legible.
4. Test empty/loading/error/recovery flows and large-content layouts, not only the happy-path appearance.

### P3 - Technical refinement

1. Split frontend/Rust boundaries described in Section P and introduce schema-versioned persistence.
2. Implement/evaluate real hybrid retrieval, token budgeting, better chunking, and relevance fixtures.
3. Incrementalize crawler/tree/stat APIs; virtualize large trees/conversations; lazy-load highlighting and any retained graph.
4. Remove dead dependencies/code, resolve Clippy, pin tooling, add frozen complete-repo CI, and reduce duplicate Rust dependency generations where practical.
5. Rewrite documentation against tested behavior and add release/version automation.

### P4 - Optional future work

- Carefully scoped multi-workspace research after isolation is proven.
- Tested instruction profiles/personas tied to real workflows.
- Multimodal document/image ingestion with provider capability negotiation.
- Web research with a distinct privacy/source model.
- Safe proposed changes or agent actions using patch previews, workspace sandboxing, policy, and rollback.
- Relationship/architecture visualization only if retrieval or comprehension evaluations show unique value.
- Additional locales, overlay/global access, and deeper Git intelligence after core adoption validates them.

---

## Final Assessment

Atlas deserves a focused refresh, not preservation of every v0.9.2-era experiment. Its local Tauri/Rust core is viable, but trust must be earned at the ingestion, retrieval, evidence, privacy, and release boundaries before visual redesign. The correct first move is to make a smaller product true.
