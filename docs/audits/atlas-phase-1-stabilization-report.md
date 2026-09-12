# Atlas 1.0 Phase 1 Stabilization Report

Date: 2026-09-05
Status: COMPLETE

## A. Baseline

The audit was read in full before implementation. The current working tree, not a reconstructed tag, was treated as the development baseline. No version was changed.

Baseline versions and tools:

- Desktop npm package, Cargo package, and Tauri config: `1.0.1`.
- Root package manager: `pnpm@10.4.1`.
- Root Turbo declaration before this phase: `latest`; lockfile resolution: `2.8.10`.
- Rust minimum in Cargo: `1.77.2`.
- Local tools observed: Node `22.14.0`, pnpm `10.4.1`, rustc/cargo `1.93.0`.
- CI uses Node 24 and stable Rust.
- `apps/desktop/src-tauri/target-codex/` already existed as an untracked generated directory.

Initial `git status --short`:

```text
 M .github/workflows/release.yml
 M .github/workflows/website-ci.yml
 M apps/desktop/eslint.config.js
 M apps/desktop/package.json
 M apps/desktop/src-tauri/Cargo.lock
 M apps/desktop/src-tauri/Cargo.toml
 M apps/desktop/src-tauri/build.rs
 M apps/desktop/src-tauri/src/commands.rs
 M apps/desktop/src-tauri/src/crawler.rs
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
 M apps/desktop/src/components/Input.tsx
 M apps/desktop/src/components/LandingScreen.tsx
 M apps/desktop/src/components/OverlayChat.tsx
 M apps/desktop/src/components/SettingsModal.tsx
 M apps/desktop/src/components/SetupModal.tsx
 M apps/desktop/src/components/UpdateChecker.tsx
 M apps/desktop/src/components/WorkspaceLayout.tsx
 M apps/desktop/src/lib/api.ts
 D apps/desktop/src/lib/toast.tsx
?? apps/desktop/src-tauri/target-codex/
?? apps/desktop/src/components/ToastProvider.tsx
?? apps/desktop/src/lib/errors.ts
?? apps/desktop/src/lib/settings.ts
?? apps/desktop/src/lib/setup.ts
?? apps/desktop/src/lib/toast.ts
?? docs/audits/
```

All of that state was preserved. No reset, clean, checkout, blind restore, commit, or push was performed. The generated `target-codex/` directory was not deleted.

## B. Changes Implemented

### Reproducible baseline

- Added the existing alternate Rust target directory to `.gitignore`, without deleting it.
- Pinned Turbo to the already locked `2.8.10` version.
- Made the release workflow use the frozen pnpm lockfile.
- Kept all product versions at `1.0.1`.

### Index correctness

- Replaced delete-before-embed indexing with an explicit per-file staged lifecycle.
- Added content fingerprints, collision-resistant workspace manifest names, backward loading of legacy manifest names, atomic manifest replacement with backup recovery, durable chunk IDs, and retryable cleanup state.
- Serialized indexing per canonical workspace. Repeated UI/watcher starts coalesce onto one running job and request one rerun.
- Added persistent job status with queued/running/completed/failed state and progress counters. The frontend queries state after subscribing, so fast completion is recoverable.
- Deleted-file passes remove durable rows before removing the manifest entry. Rename is handled as a new path plus deletion of the old path.
- Cleared stale relationship rows and query embeddings whenever relevant durable index data changes.
- Fixed watcher registration order so construction failure remains retryable.

### Privacy and credentials

- Added one Rust-owned `OpenRouterPayload` construction path. The fully serialized request body is scanned after system instructions, retrieved evidence, pinned files, Git metadata, history, and the user query have been assembled.
- OpenRouter requires an explicit `allowCloud` request flag and is blocked if the complete body matches Secret Shield policy.
- Moved OpenRouter/web-search key persistence to the OS credential store through Rust. There is no credential getter IPC.
- Removed keys from persisted frontend settings. Legacy plaintext settings migrate to the OS store and are removed only after all writes succeed; otherwise users are told to re-enter them and the legacy value is left recoverable.

### Filesystem, shell, CSP, and updater

- Removed arbitrary shell execution and whole-file diff mutation from the Rust IPC handler and frontend API.
- Removed Rust shell/filesystem/OS/process/updater plugin initialization and reduced the default Tauri capability to core plus the required folder dialog.
- Folder authorization is now created only by the Rust-owned OS folder picker and retained in a Rust-owned allowlist. Frontend paths cannot self-authorize.
- Every retained file read canonicalizes both workspace and target, requires a regular file, rejects traversal/outside paths, and rejects symlink escapes.
- Index, search, chat, Git, timeline, graph, stats, tree, and watcher paths use the canonical workspace identity.
- Added an application CSP instead of `null`.
- Removed the placeholder updater configuration and updater initialization. Automatic update UI is not mounted until signing is deliberately configured.

### Chat and contracts

- Corrected rolling history so question two receives question one and answer one.
- Replaced byte-offset prompt slicing with Unicode-safe deterministic character budgets.
- Buffered Ollama NDJSON across transport chunks, including split multibyte UTF-8, and propagated malformed/provider errors.
- Added real backend cancellation for Ollama and OpenRouter streams and wired Stop to the active stream ID.
- Added connection and overall request timeouts and meaningful stream/provider failures.
- Normalized public source ranges to one-based inclusive lines and fixed line-zero navigation checks.
- Separated workspace embedding model from chat/generation model. Initial indexing selects an available Ollama embedding model and all Ollama operations honor the configured host.

### Persistence and truthful UI

- Scoped chat sessions and manual context to the active workspace path. Legacy unscoped chats remain stored but are excluded from workspace requests.
- Requests now use one canonical workspace filter; random frontend UUIDs are not retrieval identities.
- Added bounded evidence, manual-file, history, system/Git, query, and embedding-input budgets.
- Disabled or removed entry points for personas, images/vision, web search, context-slot settings, fake Optimize/Compress, synthetic Insights/analytics, Overlay Chat, unsafe Apply Diff, updater checks, and the no-op landing reindex control.

## C. Index Integrity

For a changed file Atlas now:

1. Crawls and computes the intended content fingerprint.
2. Parses/chunks the file.
3. Generates every embedding and validates the vector count before touching the currently valid rows.
4. Writes all replacement rows under new chunk IDs.
5. Atomically writes a manifest entry containing the new content/model state, new IDs, and `cleanup_pending=true`.
6. Deletes obsolete rows while retaining the committed IDs, clears stale relationship data and query cache, then atomically records `cleanup_pending=false`.

If embedding or replacement persistence fails, the previous manifest and rows remain current. If manifest publication fails, the previous manifest remains current and any staged orphan rows are removed by the next successful replacement cleanup. If cleanup is interrupted, the committed replacement remains usable and the pending cleanup is retried before the file is treated as unchanged. A manifest never advances to content whose replacement rows were not durably written.

Deleted files are processed after discovery: their rows and relationship metadata are removed before their manifest entry is removed. Jobs for the same canonical workspace cannot run concurrently; bursts set a rerun bit on the existing job.

## D. Privacy Boundary

Local Ollama requests go to the configured Ollama host, which may itself be remote and should not be described as inherently on-device. OpenRouter can receive the final system instructions, bounded retrieved chunks, bounded pinned/manual content, bounded Git-derived text, bounded history, and the user query.

Immediately before OpenRouter, Rust constructs the only permitted request-body type, requires explicit cloud authorization, serializes the complete body, and scans that serialization. A detected secret blocks the call; there is no frontend override path. No telemetry was added. Provider credentials remain Rust-owned and are not returned to React.

## E. Filesystem/Shell Boundary

Arbitrary `execute_shell_command` and `apply_diff` IPC no longer exist. Shell, filesystem, OS, process, and updater plugin authority is not registered by the Rust application. The remaining custom read operation requires a workspace selected in a Rust-owned native dialog, canonicalizes the requested file, verifies it is a file, and verifies its canonical path remains under the canonical workspace. This accounts for `..` traversal and symlink escapes.

The backend persists only the canonical paths that the user selected. A legacy frontend-only workspace must be reselected once; its frontend record is not silently destroyed.

## F. Chat Reliability

- History: rolling history includes the preceding real user/assistant pair.
- Unicode: all prompt budgets truncate on character boundaries.
- Streaming: incomplete NDJSON bytes remain buffered until a newline/EOF; malformed provider records become errors.
- Cancellation: Stop flips the backend cancellation token, stream polling observes it, and dropping the response ends generation.
- Errors/timeouts: connect and operation timeouts are set for Ollama/OpenRouter/model/embedding calls; errors reach the typed frontend stream.
- Sources: public start/end lines are one-based and the viewer scrolls to that convention.

## G. Provider/Model Contract

The workspace stores an embedding model independently from the selected chat model. Onboarding discovers embedding candidates from the configured Ollama host and will not send an arbitrary OpenRouter chat model to Ollama's embedding endpoint. Query embedding uses the workspace's indexed embedding model; generation uses the chosen Ollama or OpenRouter chat model. Health checks, discovery, indexing, query embeddings, and Ollama chat consistently receive the configured host.

## H. UI Truthfulness

The following misleading entry points are no longer available in the retained UI:

- Personas.
- Image/vision attachment.
- Web search settings/control.
- Context-slot control that did not affect requests.
- Optimize/Compress simulation.
- Synthetic analytics/Insights tab.
- Overlay Chat.
- Unsafe Apply Diff action/rendering.
- Automatic updater banner/check.
- Landing/settings reindex action when no real callback exists.

## I. Tests Added

Rust tests cover:

- Initial index commit only after durable replacement data.
- Unchanged, changed-content, and changed-model detection.
- Embedding/replacement failure preserving the previous manifest and successful retry.
- Manifest save failure not publishing in-memory current state.
- File deletion and practical rename lifecycle.
- Repeated active indexing coalescing and completed-job restart behavior.
- Manifest path collision resistance.
- One-based source ranges.
- Unicode-safe truncation.
- Ollama records split between network chunks and inside multibyte UTF-8.
- Complete OpenRouter payload blocking for secrets in query, retrieved source, pinned source, history, and Git/context metadata, plus explicit cloud authorization.
- Workspace inside/outside file access and Unix symlink escape rejection.

Frontend tests cover:

- Question 1 / answer 1 being included when sending question 2.
- Secret settings never being serialized to localStorage.

## J. Validation Results

- `pnpm install --frozen-lockfile` — PASS.
- `pnpm --filter desktop lint` — PASS, zero warnings/errors.
- `pnpm --filter desktop build` — PASS.
- `pnpm --filter desktop test` — PASS, 2 files / 2 tests.
- `pnpm build` — PASS, Turbo 2.8.10, 1/1 task.
- `cargo fmt --check` — PASS.
- `cargo check --all-targets` — PASS.
- `cargo test --all-targets` — PASS, 21/21 library tests plus 0 binary tests.
- `cargo clippy --all-targets -- -D warnings` — PASS.
- `pnpm tauri dev` — PASS as a basic launch smoke: Vite became ready, Rust compiled, and `target/debug/app.exe` ran. The process was then intentionally stopped with Ctrl+C; no indexing/provider E2E flow was claimed.
- `git diff --check` — FAIL only on `apps/desktop/src/components/SetupModal.tsx:291: new blank line at EOF`, which was already modified before Phase 1. It was preserved rather than rewriting unrelated user work. Git also printed existing LF/CRLF conversion warnings.
- Website tests/build — NOT RUN. Website code and its independent npm workspace were not changed by this phase; its workflow was already dirty before work.

## K. Remaining Known Issues

- Workspace removal still unregisters the frontend workspace without purging its local LanceDB/manifest data. The data is no longer silently authorized, but an explicit purge/retention UX belongs in Phase 2.
- The new tests own the transaction protocol and critical boundaries, but a packaged fixture-driven Tauri E2E test with a mocked Ollama server is still needed.
- Retrieval quality, hidden-file policy, PDF quality/size behavior, binary/non-UTF-8 messaging, long/UNC/case-folding path fixtures, and model-dimension migration remain future work.
- The context budget is an explicit Unicode-safe character approximation, not fake token precision.
- Legacy unused component source and corresponding JavaScript plugin packages remain in the tree because several files contained pre-existing user modifications. They are not mounted and their Tauri backend authority is not registered. Remove them coherently during product reduction.
- Global chat/history persistence is only minimally workspace-scoped; schema versioning, migration UX, and full persistence redesign remain Phase 2 work.
- The main frontend bundle remains large. No dependency modernization or broad UI refactor was attempted.
- Update checks remain disabled until real public signing configuration and release fixtures exist.

## L. Files Changed

### Files modified or created by this task

```text
.github/workflows/release.yml (integrated with pre-existing edits)
.gitignore
package.json
pnpm-lock.yaml
apps/desktop/package.json (integrated)
apps/desktop/src-tauri/Cargo.lock (integrated)
apps/desktop/src-tauri/Cargo.toml (integrated)
apps/desktop/src-tauri/capabilities/default.json
apps/desktop/src-tauri/src/commands.rs (integrated)
apps/desktop/src-tauri/src/credentials.rs
apps/desktop/src-tauri/src/embeddings.rs
apps/desktop/src-tauri/src/git.rs (integrated)
apps/desktop/src-tauri/src/lib.rs (integrated)
apps/desktop/src-tauri/src/llm.rs (integrated)
apps/desktop/src-tauri/src/manifest.rs (integrated)
apps/desktop/src-tauri/src/outbound.rs
apps/desktop/src-tauri/src/parser.rs (integrated)
apps/desktop/src-tauri/src/vectorstore.rs (integrated)
apps/desktop/src-tauri/src/watcher.rs (integrated)
apps/desktop/src-tauri/src/workspace.rs
apps/desktop/src-tauri/tauri.conf.json (integrated)
apps/desktop/src/App.tsx (integrated)
apps/desktop/src/components/CodeDiffProposed.tsx (integrated)
apps/desktop/src/components/InlineFileViewer.tsx
apps/desktop/src/components/Input.tsx (integrated)
apps/desktop/src/components/LandingScreen.tsx (integrated)
apps/desktop/src/components/OverlayChat.tsx (integrated)
apps/desktop/src/components/SettingsModal.tsx (integrated)
apps/desktop/src/components/WorkspaceLayout.tsx (integrated)
apps/desktop/src/lib/api.ts (integrated)
apps/desktop/src/lib/chatContext.test.ts
apps/desktop/src/lib/chatContext.ts
apps/desktop/src/lib/chats.ts
apps/desktop/src/lib/settings.test.ts
apps/desktop/src/lib/settings.ts (pre-existing untracked file, integrated)
docs/audits/atlas-phase-1-stabilization-report.md
```

`cargo fmt` also formatted touched Rust modules in place; it did not reset or replace unrelated content.

### Files already dirty before this task

```text
.github/workflows/release.yml
.github/workflows/website-ci.yml
apps/desktop/eslint.config.js
apps/desktop/package.json
apps/desktop/src-tauri/Cargo.lock
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/build.rs
apps/desktop/src-tauri/src/commands.rs
apps/desktop/src-tauri/src/crawler.rs
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
apps/desktop/src/components/Input.tsx
apps/desktop/src/components/LandingScreen.tsx
apps/desktop/src/components/OverlayChat.tsx
apps/desktop/src/components/SettingsModal.tsx
apps/desktop/src/components/SetupModal.tsx
apps/desktop/src/components/UpdateChecker.tsx
apps/desktop/src/components/WorkspaceLayout.tsx
apps/desktop/src/lib/api.ts
apps/desktop/src/lib/toast.tsx (deleted before work)
apps/desktop/src-tauri/target-codex/ (untracked generated directory)
apps/desktop/src/components/ToastProvider.tsx (untracked)
apps/desktop/src/lib/errors.ts (untracked)
apps/desktop/src/lib/settings.ts (untracked)
apps/desktop/src/lib/setup.ts (untracked)
apps/desktop/src/lib/toast.ts (untracked)
docs/audits/atlas-v0.9.2-audit.md (untracked audit input)
```

No commit or push was performed. Phase 2 was not started.
