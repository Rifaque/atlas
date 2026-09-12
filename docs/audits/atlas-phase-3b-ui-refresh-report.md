# Atlas 1.0 Phase 3B UI Refresh Report

Date: 2026-09-05
Status: COMPLETE, with the runtime-QA limitations recorded in section S

## A. Baseline

Phase 3B began from the already-dirty working tree produced by the user's pre-audit work and the completed Phase 1, Phase 2, and Phase 3A work. `git status --short` was recorded before application changes. No reset, clean, checkout, commit, or push was performed.

The retained Phase 2 architecture was used rather than collapsed: one canonical active workspace, workspace-scoped sessions and manual context, dedicated history/evidence/index/chat hooks, typed evidence and index-health contracts, Rust-owned credentials, a complete-payload outbound policy, and restricted workspace file access.

Important pre-existing work preserved includes the Phase 1 Rust indexing/privacy/security changes, the Phase 2 product removals and domain modules, all audit documents, the untracked Phase 3A specification, repository workflow/configuration edits, and the user-modified `agents.md`. The latter remains in place and was not moved or deleted.

The version/configuration baseline remained `1.0.1` in the desktop package and Tauri configuration. Phase 3B did not bump it.

## B. Final UX Architecture

The implemented hierarchy is:

```text
Launcher
  -> one active Workspace
       -> Ask | Find
       + collapsible History
       + contextual Evidence & Files (Sources | Files | Context)
       + Settings sheet
```

Ask and Find are sibling modes in the permanent workspace shell. Switching modes does not recreate the conversation controller or discard the Ask draft. History is a compact left rail. Evidence is an optional, resizable right pane on wide windows and an overlay drawer on narrow windows. Settings is a focus-managed sheet rather than a primary destination.

No removed experimental product area was reintroduced.

## C. Visual System

`apps/desktop/src/index.css` now provides a small semantic token layer for canvas/surface levels, text hierarchy, dividers, action accent, success/warning/error, radius, elevation, spacing, and transition timing. It supports dark, light, and system theme selection without a remote font or configurable accent.

The UI uses the platform system sans-serif stack. Paths, source ranges, code, and technical metadata use a system monospace stack. The single restrained blue accent is used primarily for action and evidence provenance. Surfaces are neutral and mostly separated by dividers instead of nested cards. There are no gradients, glowing borders, glass effects, decorative AI objects, or dashboard KPI styling.

Motion is limited to short panel/state transitions and is disabled under `prefers-reduced-motion`.

The shared primitives in `components/ui.tsx` cover buttons, icon buttons, text fields, textarea, spinner, alerts, empty states, dialog/sheet behavior, status dots, visually hidden text, and simple surfaces. They include consistent focus-visible, disabled, loading, labelling, and dialog-focus behavior.

## D. Launcher

The launcher is now a desktop workspace opener rather than onboarding:

- Known workspaces render as restrained rows with name, path, availability, factual index state, file/chunk counts, embedding model, and last completed time when the backend provides them.
- A ready, compatible workspace opens directly. Re-selecting a known folder restores backend authorization without needlessly reindexing it.
- Never-indexed, failed, indexing, and incompatible states are explicit. Indexing shows backend counters and only shows a percentage when the reported total makes one factual.
- An unavailable workspace remains visible with a persistent recovery message.
- Remove means remove from the launcher; its copy explicitly states that index/history data remains.
- Provider configuration is requested only when indexing requires it. Settings remains secondary.

Launcher summaries intentionally compose the existing typed workspace-authorization and index-health commands. No analytics endpoint or synthetic metadata was introduced. The current authorization API is boolean, so the launcher cannot distinguish a missing path from lost authorization; this is recorded in section V.

## E. Workspace Shell

The shell continuously identifies the active workspace by name and path. The centered Ask/Find mode control is the only primary navigation. Quiet header status shows factual index state plus `Local · Ollama` or `Cloud · OpenRouter`; the generation model is subordinate metadata.

Index/provider failures appear in a persistent strip below the header. Healthy state remains quiet. History, Evidence, Settings, and switch-to-launcher actions use labelled secondary controls. The center surface always receives the remaining height, whether or not a problem strip is present.

Keyboard shortcuts operate at shell level without reintroducing a command palette: `/` focuses the current query field, Ctrl+1/Ctrl+2 switch modes, Ctrl+N creates a chat, Ctrl+Shift+H toggles History, Ctrl+Shift+E toggles Evidence, and Escape closes contextual overlays.

## F. Ask

Ask renders workspace-scoped user and assistant turns with compact readable typography, Markdown/GFM, code formatting, and associated source links. Assistant turns persist meaningful `streaming`, `complete`, `stopped`, and `failed` states. Provider and cloud-policy failures remain associated with the affected turn instead of existing only as a toast.

The empty state contains only workspace/index readiness and static examples that teach grounded workspace questions. The multiline composer is visually primary: Enter submits, Shift+Enter inserts a newline, and IME composition is respected. It exposes the actual destination (`Local · Ollama` or `Cloud · OpenRouter`), pinned-file count, Git-context state, disabled reasons, and a real Stop control while generation is active. Model selection is not placed in the composer.

Inline citations focus the matching source in the Evidence pane without replacing conversation state. When retrieval returns no sources, the answer uses neutral wording rather than a fabricated confidence or relevance claim.

## G. Find

Find is direct ranked retrieval over the same workspace. It shows display path, one-based line range, and snippet. It does not expose raw vector distance as confidence or manufacture relevance percentages.

Results can open in Evidence, be pinned into the active chat's context, or transfer a factual file/range reference into Ask. Find includes explicit idle, searching, zero-results, and failure states. Ask draft and conversation state survive mode switching.

The backend currently establishes a reliable zero-candidate state, not a calibrated semantic-relevance threshold. The UI therefore avoids claiming that non-empty candidates are definitively relevant.

## H. Evidence & Files

The right pane is the single evidence/file-inspection domain with `Sources`, `Files`, and `Context` tabs.

- Sources are tied to the selected Ask response or Find result and show path, line range, snippet, selection, next/previous navigation, copy path, open preview, and pin actions.
- Files provides a keyboard-operable workspace tree and embedded preview without IDE tabs or editing chrome.
- Source preview is a bounded reading surface with path, line numbers, highlighted ranges, horizontal code scrolling, copy path, pinning, missing-file errors, and stale-range warnings.
- Routine inspection is not modal and does not destroy Ask/Find state.

On wide windows the pane defaults to 420 px and resizes between 360 and 520 px. Its width and open state persist locally and are clamped before use. On narrow windows it becomes an overlay drawer.

## I. Context Basket

Manual context is always visible near the composer as a factual `Context · N files` indicator. The Context tab lists the pinned path set for the active workspace chat, supports individual removal and clear-all, and visibly marks files that cannot be read.

Pinned items retain the Phase 2 session/workspace ownership model. Switching workspace cannot reuse another workspace's context. No guessed token count is displayed. Git-context inclusion is separately stated.

Detailed per-request context-assembly telemetry was deliberately not added: the already-reliable pinned count, selected evidence, history behavior, and Git toggle provide honest visibility without creating a larger backend contract or fake token precision.

## J. History

History is a secondary left rail, collapsed by default. Expanded history groups sessions using existing timestamps (Today, Previous 7 days, Earlier), highlights the active session, and exposes New Chat, open, rename, export, and delete. It remains workspace-scoped through the Phase 2 persistence layer.

The collapsed state keeps a labelled access control without permanently consuming conversation width. In narrow layout, expanded History overlays the center and is mutually exclusive with the Evidence drawer.

## K. Indexing

The UI represents only factual states from `IndexHealth`: required, queued/running, ready/current, failed, and incompatible. Embedding-provider/model prerequisites are actionable. Initial indexing identifies the embedding model and exposes file counters/progress supplied by the existing job contract. Failure offers retry; a healthy index reduces to a quiet header state.

Atlas does not fabricate coverage, velocity, latency, or health scores. Changed-files-pending is not shown because the current backend does not expose it reliably.

## L. Local/Cloud Privacy UX

Persistent header and composer state use exact labels: `Local · Ollama` and `Cloud · OpenRouter`.

First OpenRouter enablement for a workspace requires versioned, explicit consent in Models & Privacy. The disclosure states that the question, retrieved workspace evidence, pinned context, relevant history, and Git context when enabled may leave the machine, and that Atlas checks the complete outbound payload before transmission. Consent is workspace-scoped and normal authorized requests do not show repetitive confirmations.

A blocked outbound payload becomes a persistent failed assistant turn and an inline composer error. It explains that sensitive content was detected somewhere in the outbound payload, does not reveal the detected value, and does not silently fall back to local generation.

Credential value entry is handed directly to the Rust-owned credential boundary. The frontend persists only credential presence/configuration, never the secret. Settings can set/replace/remove the credential and never reads it back.

## M. Settings

Settings is a large focus-managed sheet with internal navigation and four sections:

- General: system/light/dark theme.
- Models & Privacy: Ollama host, embedding model, local/OpenRouter generation provider and model, Git-context toggle, credential presence/replacement/removal, and versioned cloud disclosure.
- Indexing: factual health, embedding compatibility, refresh/rebuild, watcher explanation, and supported-format summary.
- Advanced: diagnostics/version and the explicitly disabled updater state.

Fields use draft/save semantics. Host/model errors are inline, Save is disabled for invalid state, and unsaved close is confirmed. Provider testing reports inline readiness. Secret fields are blank after storage and localStorage never receives their value.

## N. Responsive Desktop Layout

The configured minimum Tauri window is 1000×640.

- Wide: compact History rail | dominant Ask/Find center | optional resizable Evidence pane.
- Normal laptop: History remains collapsible and Evidence optional; center retains priority.
- Narrow (below 1100 px): History and Evidence become mutually exclusive overlays. Ask/Find and the composer remain mounted and usable beneath them.

The layout intentionally does not target mobile. Persisted panel width is clamped to the safe range, and contextual overlays close with Escape.

## O. Accessibility

All icon-only actions have accessible names. Ask/Find and Evidence tabs use tab semantics and selection state. The file browser exposes tree/treeitem/group roles, expansion state, level, and arrow-key navigation. Dialogs trap focus, close with Escape where safe, and restore focus. Persistent statuses use appropriate status/alert roles, while toasts are reserved for transient outcomes and include a labelled dismiss button.

Focus-visible treatment is consistent across buttons, inputs, rows, tree items, and tabs. Important actions are not hover-only. Themes use tokenized contrast, and reduced-motion preferences suppress nonessential transition behavior.

## P. Supporting Backend Contracts

One small backend addition was required: allowlisted `remove_credential`, used to delete the Rust-owned OpenRouter credential without returning it to React. It is registered as a narrow Tauri command and covered by an allowlist test.

The launcher, evidence, indexing, cancellation, and cloud-policy UI reuse the typed Phase 1/2 contracts. No new analytics, retrieval redesign, token-reporting system, or generic backend service was introduced.

The Tauri minimum window height was raised from 600 to 640 to match the verified minimum layout.

## Q. Tests Added

Phase 3B added 20 frontend interaction/integration tests on top of the 11 Phase 1/2 frontend tests, for a total of 31:

- Launcher: ready factual metadata, unavailable recovery, index-required state, and ready-workspace reauthorization without reindex.
- Ask/Find: composer keyboard behavior, citation opening, persistent cloud-blocked error, mode-switch draft preservation, result inspection, pinning, and transfer to Ask.
- Evidence/context: non-modal source opening, visible pinned state, unavailable item, and removal.
- History: active selection, actions, and collapse.
- Indexing: required, running, failed, and healthy rendering.
- Cloud/settings: Local/Cloud state, first-enablement disclosure, secret non-display, validation, and draft/save.
- Accessibility: dialog Escape/focus behavior and semantic roles exercised through Testing Library.

The Rust suite is now 25 tests, including the new credential-name allowlist test. All Phase 1/2 indexing, cloud-payload, workspace authorization, evidence, Unicode, streaming, and cancellation tests remain.

## R. Validation Results

All commands were run from the stated directory on 2026-09-05.

| Command | Directory | Result |
| --- | --- | --- |
| `pnpm test -- --run` | `apps/desktop` | PASS — 7 files, 31 tests |
| `pnpm lint` | `apps/desktop` | PASS |
| `pnpm build` | `apps/desktop` | PASS — TypeScript and Vite |
| `cargo fmt --check` | `apps/desktop/src-tauri` | PASS |
| `cargo check --all-targets` | `apps/desktop/src-tauri` | PASS |
| `cargo clippy --all-targets -- -D warnings` | `apps/desktop/src-tauri` | PASS |
| `cargo test --all-targets` | `apps/desktop/src-tauri` | PASS — 25 tests |
| `pnpm install --frozen-lockfile` | repository root | PASS |
| `pnpm build` | repository root | PASS — Turbo 1/1 |
| `git diff --check` | repository root | PASS (only Git line-ending notices were emitted by the combined inspection command) |

No website package exists in the current workspace manifest; the root Turbo build covered its only package, `desktop`.

## S. Runtime QA

`pnpm tauri dev` successfully compiled and launched the real Windows application. The launcher was visually inspected at a large desktop size and at the configured 1000×640 minimum. Workspace rows, status hierarchy, overflow, action sizing, and the minimum-height launcher layout were usable without clipping. The dark-theme Settings sheet was opened and inspected for hierarchy, disclosure copy, input layout, and visible focus.

The runtime produced only `tao` event-loop ordering warnings during the inspection. The process was stopped after QA; the final non-zero process status was the expected Ctrl+C termination.

The stored workspace required folder reauthorization after restart, and the available advertised GUI-control skill could not be loaded from its configured path. Consequently, live Ask, Find, Evidence, file preview, history, narrow workspace drawer behavior, and light-theme appearance were not directly exercised in the native window. Those behaviors are covered by component/integration tests and production builds, but this report does not claim runtime visual observation for them.

Temporary QA screenshots were written outside the repository and were not added as product assets.

## T. Performance/Bundle Findings

Production output after Phase 3B:

- JavaScript: 423.73 kB, 131.16 kB gzip.
- CSS: 51.50 kB, 9.65 kB gzip.
- HTML: 0.46 kB, 0.29 kB gzip.

The pre-refresh frontend build observed during this phase was approximately 409.11 kB JavaScript (126.36 kB gzip) and 58.54 kB CSS (10.02 kB gzip). The accessible interaction layer increased gzip JavaScript by about 4.8 kB while the replacement CSS reduced gzip CSS by about 0.4 kB.

No syntax-highlighting dependency was reintroduced. Source preview uses bounded backend reads and plain readable code rendering. No concrete performance regression was observed during launcher/settings runtime QA. Very large conversations and large file trees still merit dedicated profiling only if measurements show a problem.

## U. Reduction / Change Metrics

- Production component modules added: 7 (`ui`, `WorkspaceHeader`, `HistoryPanel`, `AskView`, `FindView`, `EvidencePane`, `ToastProvider`).
- Legacy component modules removed in Phase 3B: 2 (`Button`, `GlassPanel`), after their retained use was replaced by the focused primitives.
- UI modules materially rewritten: 8 (`App`, `LandingScreen`, `WorkspaceLayout`, `SettingsModal`, `FileTree`, `InlineFileViewer`, the HTML entry, and the style layer).
- Backend commands added: 1 narrow credential-removal command.
- Runtime dependencies added: 0.
- Test-only dependencies added: 4 Testing Library/jsdom packages; Vitest was retained/configured from the Phase 2 test baseline.
- Approximate Phase 3B net change: about +800 lines including interaction tests and this report. This is an estimate because the working tree already contained uncommitted Phase 1/2 files, so Git cannot isolate a trustworthy phase-only numstat.

## V. Remaining Issues

1. Complete native-window QA is still needed with a reauthorized, indexed fixture workspace, especially Ask streaming, source jumps, Files preview, context pinning, workspace history, narrow drawers, and the light theme.
2. Launcher availability is currently derived from backend authorization plus index-health calls. The boolean authorization contract cannot distinguish a deleted/moved folder from a folder that merely needs access restored.
3. Retrieval has a truthful zero-results state but no calibrated semantic threshold for “weak evidence”; the UI intentionally makes no relevance claim.
4. Detailed request-context assembly reporting remains limited to reliably known UI facts (pinned count, selected evidence, history behavior, Git toggle). Accurate token accounting was not added.
5. Large conversations and unusually large file trees have not been stress-profiled.

None of these issues reopens an established Phase 1 security/data-integrity guarantee.

## W. Deferred Phase 4 Work

Phase 4 may improve retrieval quality, ranking/calibration, chunking, evidence usefulness, and claim-level grounding. It should also decide whether a defensible weak-evidence classification can be produced by retrieval.

Phase 3B did not change retrieval algorithms, LanceDB, embedding semantics, multi-model routing, or agent capabilities. Native end-to-end fixture automation is also a useful future test-infrastructure task, but it must not be confused with retrieval redesign.

## X. Files Changed

### Phase 3B modifications

- Product documentation: `README.md`, `apps/desktop/README.md`, `docs/design-doc.md`, `docs/prd.md`.
- Entry/foundation: `apps/desktop/index.html`, `apps/desktop/src/App.tsx`, `apps/desktop/src/index.css`.
- New production UI: `components/ui.tsx`, `WorkspaceHeader.tsx`, `HistoryPanel.tsx`, `AskView.tsx`, `FindView.tsx`, `EvidencePane.tsx`, `ToastProvider.tsx`.
- Reworked product UI: `LandingScreen.tsx`, `WorkspaceLayout.tsx`, `SettingsModal.tsx`, `FileTree.tsx`, `InlineFileViewer.tsx`.
- State/contracts: `features/ask/useWorkspaceChat.ts`, `features/evidence/useWorkspaceEvidence.ts`, `lib/chats.ts`, `lib/settings.ts`, `lib/settings.test.ts`, `lib/theme.ts`.
- Backend/config: `src-tauri/src/commands.rs` (product-focused greeting copy only), `src-tauri/src/credentials.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`.
- Tests: `components/LandingScreen.test.tsx`, `components/WorkspaceLayout.test.tsx`, `components/interaction.test.tsx`.
- Tooling/lockfile: `apps/desktop/package.json`, `pnpm-lock.yaml`.
- Removed after replacement: `components/Button.tsx`, `components/GlassPanel.tsx`.
- This report: `docs/audits/atlas-phase-3b-ui-refresh-report.md`.

### Pre-existing modifications preserved

The baseline already contained modified/deleted/untracked files from user work and Phases 1–3A, including `.github` workflows, `.gitignore`, `agents.md`, root package metadata, the Rust indexing/retrieval/outbound/workspace modules and manifests, removed Phase 2 feature components and plugins, frontend domain hooks/persistence tests, general architecture/benchmark/tech-stack/todo documents, both prior stabilization reports, and the Phase 3A UX specification.

No unrelated baseline file was reset, restored, cleaned, or overwritten. Files shared with Phase 3B were integrated in place.

No commit or push was performed.
