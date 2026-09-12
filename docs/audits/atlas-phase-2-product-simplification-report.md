# Atlas 1.0 Phase 2 Product Simplification Report

Date: 2026-09-05
Status: COMPLETE

## A. Baseline

The v0.9.2 audit and Phase 1 stabilization report were read completely before Phase 2 changes. Phase 1 was COMPLETE: its required frontend/Rust gates passed, its Tauri process launched, and its full application workflow had not been claimed as an E2E observation. Phase 2 treated the resulting dirty working tree as the baseline and did not reconstruct, reset, clean, commit, or push it.

Actual baseline configuration remained unchanged in this phase:

- Desktop npm package, Cargo package, and Tauri config: `1.0.1`.
- Package manager: `pnpm@10.4.1`; Turbo: `2.8.10`.
- Cargo minimum Rust: `1.77.2`; locally observed Rust during Phase 1: `1.93.0`.
- React 19, Tauri 2, Vite 7, and LanceDB 0.15 were retained without modernization.
- Updater registration/configuration remained safely absent pending real release signing.

Phase 2 baseline `git status --short`:

```text
 M .github/workflows/release.yml
 M .github/workflows/website-ci.yml
 M .gitignore
 M apps/desktop/eslint.config.js
 M apps/desktop/package.json
 M apps/desktop/src-tauri/Cargo.lock
 M apps/desktop/src-tauri/Cargo.toml
 M apps/desktop/src-tauri/build.rs
 M apps/desktop/src-tauri/capabilities/default.json
 M apps/desktop/src-tauri/src/commands.rs
 M apps/desktop/src-tauri/src/crawler.rs
 M apps/desktop/src-tauri/src/embeddings.rs
 M apps/desktop/src-tauri/src/git.rs
 M apps/desktop/src-tauri/src/lib.rs
 M apps/desktop/src-tauri/src/llm.rs
 M apps/desktop/src-tauri/src/main.rs
 M apps/desktop/src-tauri/src/manifest.rs
 M apps/desktop/src-tauri/src/parser.rs
 M apps/desktop/src-tauri/src/vectorstore.rs
 M apps/desktop/src-tauri/src/watcher.rs
 M apps/desktop/src-tauri/tauri.conf.json
 M apps/desktop/src/App.tsx
 M apps/desktop/src/components/AnalyticsDashboard.tsx
 M apps/desktop/src/components/CodeDiffProposed.tsx
 M apps/desktop/src/components/InlineFileViewer.tsx
 M apps/desktop/src/components/Input.tsx
 M apps/desktop/src/components/LandingScreen.tsx
 M apps/desktop/src/components/OverlayChat.tsx
 M apps/desktop/src/components/SettingsModal.tsx
 M apps/desktop/src/components/SetupModal.tsx
 M apps/desktop/src/components/UpdateChecker.tsx
 M apps/desktop/src/components/WorkspaceLayout.tsx
 M apps/desktop/src/lib/api.ts
 M apps/desktop/src/lib/chats.ts
 D apps/desktop/src/lib/toast.tsx
 M package.json
 M pnpm-lock.yaml
?? apps/desktop/src-tauri/src/credentials.rs
?? apps/desktop/src-tauri/src/outbound.rs
?? apps/desktop/src-tauri/src/workspace.rs
?? apps/desktop/src/components/ToastProvider.tsx
?? apps/desktop/src/lib/chatContext.test.ts
?? apps/desktop/src/lib/chatContext.ts
?? apps/desktop/src/lib/errors.ts
?? apps/desktop/src/lib/settings.test.ts
?? apps/desktop/src/lib/settings.ts
?? apps/desktop/src/lib/setup.ts
?? apps/desktop/src/lib/toast.ts
?? docs/audits/
```

The Phase 1 report also recorded `apps/desktop/src-tauri/target-codex/` as a pre-existing generated directory. It was already covered by the Phase 1 ignore rule and was not deleted.

## B. Product Definition

Atlas 1.0 is now reduced to a local-first workspace intelligence desktop app that indexes one codebase or document set, answers grounded questions with inspectable evidence, and makes every OpenRouter transfer explicit and opt-in.

The retained product loop is:

**Open Workspace → Index / Maintain Index → Ask or Find → Inspect Evidence → Follow Up**

There is one current workspace identity in the shell. The launcher may retain multiple recent registrations, but retrieval, index state, conversations, pinned context, and workspace generation selection are never combined across them.

## C. Features Removed

| Feature | Frontend | Backend/settings/dependencies | Documentation |
|---|---|---|---|
| Architecture Graph | Graph component/navigation removed | Graph IPC and relationship extraction/storage removed; `reactflow` removed | Current architecture/PRD no longer claim GraphRAG |
| Insights/analytics | Dashboard and synthetic metrics removed | Fake workspace-stat contract removed | Benchmarks marked archival/unverified |
| Personas | Persona UI/helpers removed | Ignored prompt plumbing removed from retained UI | Agent document preserved but explicitly marked archival |
| Overlay Chat | Overlay component/window entry points removed | Global-shortcut and positioner plugins removed | Current docs no longer claim overlay behavior |
| Vision/image input | Attachment/request surface removed | Unused transport and image dependency remained absent after Phase 1 | Removed from current product claims |
| Web search | Controls/settings removed | `websearch.rs`, provider credential branch, and request plumbing removed | Removed from current product claims |
| Code actions | Apply-diff rendering/wrappers removed | Unsafe IPC remained absent from Phase 1 | Atlas is explicitly not described as an agent/action platform |
| Shell execution | Remaining UI/wrappers removed | Unsafe IPC and shell capability remain absent | Current docs explicitly say no shell IPC |
| Optimize/Compress/context slots | Controls and ineffective settings removed | `contextSlots` and fake actions are not migrated into v2 settings | Removed from current settings contract |
| Zen/command center | Separate mode/palette removed | No shortcut remains | Archived design doc is labeled non-authoritative |
| Timeline | Top-level surface and API removed | Timeline IPC and crawler metadata-only route removed | Current docs exclude Timeline |
| Model playground/multi-model routing | Per-message model controls/browser removed | OpenRouter model-list IPC removed | One generation selection plus one embedding selection documented |
| Accent customization | Control and persisted field removed | Theme is only dark/light/system | Archived visual design remains historical only |
| Legacy setup/updater UI | Setup and update-check components removed | Updater remains disabled; initial indexing is the launcher lifecycle | Current docs state update checks are disabled until signing exists |

## D. Features Retained

- Launcher and recent workspaces: required to open, reauthorize, switch, and remove registrations without conflating removal with data purge.
- One active workspace: the unit of index, retrieval, history, manual context, and generation configuration.
- Failure-safe indexing, watcher refresh, durable jobs, and factual index health: the trust foundation for all Ask/Find behavior.
- Ollama embeddings/local generation and optional OpenRouter generation: the intended local-first provider model.
- Ask/chat with real cancellation, bounded context, history, Git summary, and response-associated evidence.
- Find/search, evidence results, file tree, bounded preview, citation navigation, and pin/unpin context.
- Workspace-owned session history with create/open/rename/delete/export.
- General/model/privacy/indexing/advanced settings that have retained behavior.
- Basic read-only Git context, simple theme support, system tray behavior, and safely disabled updater infrastructure.

## E. New Product Architecture

- **Launcher** owns recent registrations, workspace availability/reauthorization, folder selection, initial embedding selection/indexing, opening, and “Remove from Atlas.” It does not host generation experimentation or advanced settings.
- **Workspace shell** composes a single workspace plus Ask/Find modes, factual provider/index state, History, and Evidence. It does not contain graph/timeline/analytics destinations.
- **Ask** is implemented by `useWorkspaceChat`; it owns input, generation lifecycle, cloud confirmation, context request construction, stream association, and cancellation.
- **Find** and **Evidence** are implemented by `useWorkspaceEvidence`; they own ranked results, file tree, preview targets, and search failures. Pinned context remains owned by the active workspace session.
- **History** is implemented by `useWorkspaceHistory` over the validated v2 persistence module.
- **Indexing** is implemented by `useWorkspaceIndex`; it starts/stops the workspace watcher, polls factual health, starts refresh jobs, and reconciles terminal events with durable job state.
- **Settings** exposes only General, Models & Privacy, Indexing, and Advanced behavior.

`WorkspaceLayout.tsx` fell from the recorded Phase 2 baseline of approximately 1,128 lines to 258 lines and now composes these domains instead of owning their state machines.

One new critical boundary issue was discovered and fixed during retained-flow review: chat previously generated its retrieval embedding before canonical workspace authorization. Because a configured Ollama endpoint may be remote, a malformed direct IPC request could have transferred query text before the workspace was rejected. Chat now authorizes the canonical workspace and verifies a completed index before any provider call. Find already authorized before embedding generation.

## F. Workspace Identity

The canonical workspace ID is the canonical backend-authorized root path returned by the native Rust folder picker. The frontend v2 workspace record uses that same value for both `id` and `folderPath`; legacy random UUID records migrate to their stored path identity. The persistence envelope contains exactly one `activeWorkspaceId`.

Every retained backend operation resolves the supplied identity through the Rust authorization registry. File targets are canonicalized under that root. Search filters LanceDB by the same identity. Evidence conversion rejects a source path that cannot be made relative to that workspace. Switching returns to the launcher and mounts a new shell; the prior watcher is stopped and all domain hooks reload from the new workspace identity.

“Remove from Atlas” deletes only the launcher registration. The UI explicitly says local index and history data are retained; purge remains a distinct deferred lifecycle.

## G. Persistence Model

Workspace registrations use `atlas_workspaces_v2`:

```text
{ version: 2, workspaces: Workspace[], activeWorkspaceId: string | null }
```

History uses `atlas_history_v2`:

```text
{ version: 2,
  workspaces: { [workspaceId]: ChatSession[] },
  activeSessionIds: { [workspaceId]: sessionId } }
```

Each session contains `workspaceId`, messages/evidence, and `manualContext`. Loads validate the workspace owner, session structure, and messages. Malformed current/legacy data returns safe empty state instead of throwing. Scoped legacy sessions migrate directly. Legacy global sessions are recoverable into the previously active legacy workspace when that ownership can be established; otherwise the legacy key remains untouched rather than guessing ownership.

Settings use `atlas_settings_v2` with general theme/Ollama endpoint defaults and a workspace map for generation provider, generation model, and system instruction. A workspace change therefore cannot inherit another workspace’s selected cloud/local provider or model. The Ollama endpoint is deliberately general so the launcher can discover an embedding model before a workspace exists. Embedding configuration remains on the workspace record and is never conflated with generation configuration. Secrets are not part of any frontend persistence envelope.

## H. Frontend Refactor

The former layout’s effect clusters and stale shared state moved into four behavior-oriented hooks: Ask, Evidence/Find, History, and Indexing. `App.tsx` owns only startup migration and one active workspace. `LandingScreen.tsx` owns launcher/initial-index lifecycle. Settings persistence, history persistence, workspace persistence, and context-history construction are pure modules with focused tests.

History switching and destructive session actions are disabled during generation so stream callbacks cannot write into a newly selected session. The stream listener/event ID is registered before invoking Rust, which closes the fast-local-completion race. No Zustand/event-bus/design-system abstraction was introduced.

## I. Rust Refactor

Retained seams are now explicit modules:

- `workspace.rs`: canonical workspace authorization and bounded file authority.
- `manifest.rs` plus the indexing orchestration in `commands.rs`: transactional file lifecycle and factual persisted index state.
- `retrieval.rs`: conversion from vector-store internals to the public evidence contract.
- `llm.rs`: provider transport, timeouts, streaming framing, and cancellation.
- `outbound.rs`: the sole OpenRouter payload constructor/policy boundary.
- `credentials.rs`: Rust/OS-owned provider credential boundary.
- `errors.rs`: stable structured error codes.
- `crawler.rs`, `parser.rs`, and `vectorstore.rs`: ingestion/storage without relationship-graph behavior.

Tauri registration is reduced to thin entry points for the retained product. Large indexing and generation flows remain in `commands.rs` where moving them wholesale would have added Phase 2 risk; further mechanical extraction is deferred, not hidden behind a speculative service framework.

## J. Evidence Contract

Rust serializes this one public representation in camel case:

```ts
interface EvidenceResult {
  id: string;
  workspaceId: string;
  filePath: string;
  displayPath: string;
  lineStart: number;       // 1-based, inclusive
  lineEnd: number;         // 1-based, inclusive
  content: string;
  snippet: string;         // Unicode-safe bounded prefix
  sourceType: 'workspace_file';
}
```

Find returns this contract directly. Ask emits the evidence actually placed within the evidence budget before provider generation and stores those references on the assistant message. Sources outside the canonical workspace and rows without stable IDs are rejected. Raw vector distance is intentionally absent; Atlas does not present it as confidence.

## K. Model/Provider Contract

- **Embedding**: workspace-owned Ollama model plus factual readiness through index health. It is used by indexing and retrieval queries.
- **Generation**: workspace-owned provider (`ollama` or explicit `openrouter`) and model. Ollama health or OpenRouter credential presence is shown as readiness.
- **Ollama endpoint**: one general explicit endpoint honored by discovery, status, embedding, indexing, search, and local chat. A configured remote Ollama host is not described as on-device.
- **OpenRouter**: generation only. Each Ask request requires user confirmation; Rust requires `allowCloud`, builds the complete bounded payload once, scans it, then passes that same body to the transport.

No per-message model override, automatic router, model comparison, or OpenRouter-to-Ollama embedding fallback remains.

## L. Index Health Contract

`IndexHealth` exposes only:

```text
status: not_indexed | queued | running | ready | failed
fileCount
chunkCount
embeddingModel
lastCompletedAt
error
```

Counts and model come from the committed manifest; job state comes from the serialized workspace job. A new retry removes older terminal jobs so an old failure cannot override a later successful health state. The frontend reconciles transient events with queryable job state and polls health for watcher-triggered changes. No coverage, velocity, latency, or health score is fabricated.

## M. Error Taxonomy

The public `AppError` shape is `{ code, message }`. Stable codes available for the retained/future UI are:

`WorkspaceUnavailable`, `IndexRequired`, `IndexFailed`, `EmbeddingProviderUnavailable`, `GenerationProviderUnavailable`, `InvalidModel`, `NoRelevantEvidence`, `CloudAuthorizationRequired`, `CloudPayloadBlocked`, `FileUnavailable`, `PersistenceCorrupt`, `UpdateUnavailable`, and `Unexpected`.

Index, retrieval, file, and streamed generation failures now expose structured failures rather than requiring presentation code to infer behavior from console logs. Provider strings are classified at the Rust boundary while existing deep modules are progressively converted.

## N. Dependency Reduction

Sixteen JavaScript dependency declarations were removed because their callers/products were removed:

- `@tauri-apps/plugin-dialog`, `plugin-fs`, `plugin-os`, `plugin-process`, `plugin-shell`, `plugin-updater` (frontend packages; native folder dialog remains Rust-owned)
- `i18next`, `i18next-browser-languagedetector`, `react-i18next`
- `reactflow`, `react-resizable-panels`, `react-syntax-highlighter`
- `uuid`, `zustand`
- `@types/react-syntax-highlighter`, `@types/uuid`

Two Rust dependencies were removed: `tauri-plugin-global-shortcut` and `tauri-plugin-positioner`. Cargo’s remaining `tauri-plugin-fs` entry is transitive through the retained native dialog plugin, not registered broad filesystem IPC.

No dependency was broadly upgraded and LanceDB remains 0.15.

## O. Tests Added

Phase 1 tests remain and pass. Phase 2 added/expanded tests proving:

- Workspace A history and manual context do not load in Workspace B.
- Active session identity persists independently by workspace and survives reload.
- Scoped legacy history migrates; unscoped history migrates only when the prior active workspace is recoverable; corrupt data fails safely.
- Legacy multiple-active workspace data becomes one canonical path identity.
- Generation provider/model settings are workspace-scoped and obsolete settings do not re-enter retained behavior.
- Provider secrets are not serialized to frontend storage.
- Evidence serialization has stable camel-case fields, one-based ranges, the correct workspace owner/source type, and no fake score.
- Evidence paths outside the workspace are rejected.
- Repeated indexing requests coalesce and a completed job does not block a later job.

Static source/registration inspection also confirmed removed graph, timeline, web-search, secret-scan, OpenRouter-model-list, shell, and apply-diff IPC are not registered.

## P. Validation Results

- `pnpm install --frozen-lockfile` — PASS; lockfile current under pnpm 10.4.1.
- `pnpm --filter desktop lint` — PASS; zero warnings/errors.
- `pnpm --filter desktop test` — PASS; 4 files / 9 tests.
- `pnpm --filter desktop build` — PASS; TypeScript and Vite production build.
- `pnpm build` — PASS; Turbo 2.8.10, 1/1 workspace task.
- `cargo fmt --check` — PASS.
- `cargo check --all-targets` — PASS.
- `cargo clippy --all-targets -- -D warnings` — PASS.
- `cargo test --all-targets` — PASS; 24/24 library tests, 0 binary tests.
- `pnpm --filter desktop tauri dev` — PASS as a launch smoke. Vite became ready, Rust compiled, and `target/debug/app.exe` ran. It was intentionally stopped with Ctrl+C, so the resulting control-C process status is not an application failure.
- `ollama list` — PASS; local Ollama 0.31.1 launched and both generation models and `nomic-embed-text:latest` were observed.
- Full launcher → index → Ask → evidence → second chat → reload → workspace switch E2E — NOT RUN. The prerequisites were present, but this terminal run did not automate native folder-dialog/webview interaction; no runtime behavior beyond process launch is claimed.
- Website validation — NOT RUN. `website/` is outside the pnpm workspace and no website source/config was changed; root/desktop dependency changes were validated by frozen install and Turbo build.
- `git diff --check` — PASS; Git printed only repository line-ending conversion notices.

## Q. Reduction Metrics

- Files deleted: 15 (9 components, 1 Rust web-search module, 3 obsolete frontend support modules including the pre-existing untracked setup helper, and 2 unused template assets).
- Components removed: 9.
- Persisted/control settings removed: 6 obsolete fields/concepts (`backendUrl`, `contextSlots`, web-search enable/provider/key, and accent customization).
- IPC commands removed: 6 (`get_graph_data`, `get_timeline`, `web_search`, `scan_secrets`, `list_openrouter_models`, and fake `get_index_stats`; factual `get_index_health` replaces the last one).
- Other backend desktop capabilities removed: 2 plugins (global shortcut and window positioner).
- Dependency declarations removed: 18 total (16 JavaScript, 2 Rust).
- Approximate Phase 2 net code reduction: about 3,000 lines. For reference, the whole dirty working tree versus Git `HEAD` is 3,800 fewer tracked lines, but that number includes Phase 1 and excludes new untracked files; the Phase 2 estimate uses the recorded component/layout/settings baselines and added domain/test modules.

## R. Deferred Work

- A user-confirmed “Delete Atlas index/history data” purge is still separate from launcher removal and remains unimplemented.
- Native packaged E2E automation with a mock/local Ollama server remains needed; this phase observed only process launch plus unit/build gates.
- `commands.rs` still contains the concrete indexing and generation orchestration. Its behavior is bounded and tested, but further extraction should be mechanical and driven by Phase 3 needs.
- Persistence remains validated localStorage for non-secret UI state rather than a database. A user-visible corrupt-state recovery/export flow is future work.
- Character-count context budgets remain an honest Unicode-safe approximation, not token precision.
- Model-dimension migrations, UNC/case-folding path fixtures, non-UTF-8 file UX, PDF quality limits, retrieval tuning, and claim-level citation attribution remain later work.
- Legacy LanceDB relationship tables may remain on disk but are inert and no longer read or written; deleting user data requires the future explicit purge lifecycle.
- The Phase 3 visual language, responsive layout refinement, accessibility polish, and final information design were deliberately not started.

## S. Files Changed

### Phase 2 modifications

```text
README.md
agents.md (preserved in place; archival truthfulness note only)
apps/desktop/README.md
apps/desktop/package.json
apps/desktop/src-tauri/Cargo.lock
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/src/commands.rs
apps/desktop/src-tauri/src/crawler.rs
apps/desktop/src-tauri/src/credentials.rs
apps/desktop/src-tauri/src/errors.rs
apps/desktop/src-tauri/src/lib.rs
apps/desktop/src-tauri/src/manifest.rs
apps/desktop/src-tauri/src/parser.rs
apps/desktop/src-tauri/src/retrieval.rs
apps/desktop/src-tauri/src/vectorstore.rs
apps/desktop/src-tauri/src/websearch.rs (deleted)
apps/desktop/src/App.css (deleted)
apps/desktop/src/App.tsx
apps/desktop/src/assets/react.svg (deleted)
apps/desktop/src/components/AnalyticsDashboard.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/ArchitectureGraph.tsx (deleted)
apps/desktop/src/components/CodeDiffProposed.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/CommandPalette.tsx (deleted)
apps/desktop/src/components/FileTree.tsx
apps/desktop/src/components/InlineFileViewer.tsx
apps/desktop/src/components/Input.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/LandingScreen.tsx
apps/desktop/src/components/ModelSelector.tsx (deleted)
apps/desktop/src/components/OverlayChat.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/SettingsModal.tsx
apps/desktop/src/components/SetupModal.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/UpdateChecker.tsx (deleted; integrated pre-existing edits)
apps/desktop/src/components/WorkspaceLayout.tsx
apps/desktop/src/features/ask/useWorkspaceChat.ts
apps/desktop/src/features/evidence/useWorkspaceEvidence.ts
apps/desktop/src/features/history/useWorkspaceHistory.ts
apps/desktop/src/features/indexing/useWorkspaceIndex.ts
apps/desktop/src/lib/api.ts
apps/desktop/src/lib/chats.test.ts
apps/desktop/src/lib/chats.ts
apps/desktop/src/lib/errors.ts
apps/desktop/src/lib/i18n.ts (deleted)
apps/desktop/src/lib/personas.ts (deleted)
apps/desktop/src/lib/settings.test.ts
apps/desktop/src/lib/settings.ts
apps/desktop/src/lib/setup.ts (pre-existing untracked file deleted)
apps/desktop/src/lib/theme.ts
apps/desktop/src/lib/workspaces.test.ts
apps/desktop/src/lib/workspaces.ts
apps/desktop/src/main.tsx
docs/architecture.md
docs/benchmarks.md
docs/design-doc.md
docs/prd.md
docs/tech-stack.md
docs/todo.md
docs/audits/atlas-phase-2-product-simplification-report.md
pnpm-lock.yaml
```

### Already dirty before Phase 2

```text
.github/workflows/release.yml
.github/workflows/website-ci.yml
.gitignore
apps/desktop/eslint.config.js
apps/desktop/package.json
apps/desktop/src-tauri/Cargo.lock
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/build.rs
apps/desktop/src-tauri/capabilities/default.json
apps/desktop/src-tauri/src/commands.rs
apps/desktop/src-tauri/src/crawler.rs
apps/desktop/src-tauri/src/embeddings.rs
apps/desktop/src-tauri/src/git.rs
apps/desktop/src-tauri/src/lib.rs
apps/desktop/src-tauri/src/llm.rs
apps/desktop/src-tauri/src/main.rs
apps/desktop/src-tauri/src/manifest.rs
apps/desktop/src-tauri/src/parser.rs
apps/desktop/src-tauri/src/vectorstore.rs
apps/desktop/src-tauri/src/watcher.rs
apps/desktop/src-tauri/tauri.conf.json
apps/desktop/src/App.tsx
apps/desktop/src/components/AnalyticsDashboard.tsx
apps/desktop/src/components/CodeDiffProposed.tsx
apps/desktop/src/components/InlineFileViewer.tsx
apps/desktop/src/components/Input.tsx
apps/desktop/src/components/LandingScreen.tsx
apps/desktop/src/components/OverlayChat.tsx
apps/desktop/src/components/SettingsModal.tsx
apps/desktop/src/components/SetupModal.tsx
apps/desktop/src/components/UpdateChecker.tsx
apps/desktop/src/components/WorkspaceLayout.tsx
apps/desktop/src/lib/api.ts
apps/desktop/src/lib/chats.ts
apps/desktop/src/lib/toast.tsx (already deleted)
package.json
pnpm-lock.yaml
apps/desktop/src-tauri/src/credentials.rs (untracked Phase 1 output)
apps/desktop/src-tauri/src/outbound.rs (untracked Phase 1 output)
apps/desktop/src-tauri/src/workspace.rs (untracked Phase 1 output)
apps/desktop/src/components/ToastProvider.tsx (untracked Phase 1 output)
apps/desktop/src/lib/chatContext.test.ts (untracked Phase 1 output)
apps/desktop/src/lib/chatContext.ts (untracked Phase 1 output)
apps/desktop/src/lib/errors.ts (untracked Phase 1 output)
apps/desktop/src/lib/settings.test.ts (untracked Phase 1 output)
apps/desktop/src/lib/settings.ts (untracked Phase 1 output)
apps/desktop/src/lib/setup.ts (untracked pre-existing/Phase 1-integrated file)
apps/desktop/src/lib/toast.ts (untracked Phase 1 output)
docs/audits/ (untracked, including the supplied audit and Phase 1 report)
```

No commit or push was performed. All unrelated pre-existing work was preserved, and the requested in-scope removal of already-modified obsolete feature files was performed deliberately rather than by reset or checkout. Phase 3 was not started.
