# Atlas 1.0 Phase 3C Runtime, Visual, and Interaction QA Report

## A. QA Environment

- **Date:** 2026-09-05
- **Application:** native Tauri development build using the repository working tree at commit `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a` plus the preserved Phase 1–3B changes.
- **Workspace tested:** `<local test workspace>` (the backend retained its canonical extended Windows identity internally).
- **Authorization:** Atlas loaded the workspace through its existing Rust-owned authorization record and normal launcher/open flow. No path authorization check was bypassed or weakened.
- **Index:** already healthy, so it was not rebuilt unnecessarily. The UI reported 102 files and 567 chunks. The existing embedding model was `nomic-embed-text:latest`.
- **Generation:** local Ollama at `127.0.0.1`, using `llama3.2:latest`.
- **Themes inspected:** dark and light; dark was restored at the end of QA.
- **Native window sizes:** approximately 1900×1050 outer / 1886×1014 content, 1366×768 outer / 1352×731 content, and the configured 1000×640 minimum outer / 986×603 content. The window was also dragged across breakpoints.
- **Runtime inspection:** the real Tauri WebView2 window was exercised. CDP attached to that WebView2 instance for DOM measurements and screenshots; Win32 APIs resized the native window. The advertised computer-use skill file was unavailable in this environment, so this equivalent local inspection path was used.
- **Baseline:** the working tree was already extensively dirty with the complete, uncommitted Phase 1–3B implementation and older user work. `git status --short` was recorded before Phase 3C. No reset, clean, checkout, commit, or push was performed.

## B. Native Workflow Results

### Launcher → workspace

The launcher rendered the authorized Jan & Bros workspace with factual availability and index information. Workspace open, long-path presentation, dark/light themes, and minimum-width layout were inspected. The extended Windows path prefix was initially visible and was corrected as described below.

### Ask

A new workspace-scoped session was created. The question “What is the main purpose of this project and where is it described?” completed through local Ollama with five sources. A suggested follow-up was then submitted and completed with five sources, proving history continuity in the real UI. The empty state, composer, generation state, Markdown, code treatment, long-answer scrolling, source affordances, and Local/Ollama destination were inspected. The final hierarchy reads as an evidence workbench rather than a generic chatbot.

### Evidence

The first source was opened, then source navigation moved to the second source. One-based line ranges and highlighted lines were correct. The source remained alongside the conversation at wide and laptop sizes. Selection, path hierarchy, preview scrolling, and pinning were exercised. A preview containment defect that displaced the file-tree header was fixed.

### Find

Several direct searches were attempted. This exposed a Windows-only workspace filter defect that caused valid indexed rows to be excluded. After correction, “design language” returned ten ranked passages, with paths, snippets, and line ranges but no fabricated percentage/confidence. A result opened in Evidence and another was pinned. A 168-character query remained usable without page overflow. Ask conversation and an unsent draft survived Ask → Find → Ask switching.

The current vector retrieval contract normally returns nearest candidates for non-empty indexed workspaces, so a semantic “no relevant result” condition could not be honestly induced at runtime. The explicit zero-result UI remains covered by frontend tests; no relevance threshold was invented during this phase.

### Files and preview

The file tree was inspected at shallow and deep levels. `docs/strategy` was expanded with the keyboard and displayed level-three children. Long names and paths remained bounded. `PROJECT_OVERVIEW.md` opened in the source preview, and code/text scrolling remained local to the preview. Atlas continues to present this as evidence browsing, not an editor.

### Context basket

Two files were pinned from Sources/Find. The tab and composer showed the factual pinned count. One item was removed and Clear All was exercised, returning to zero items. Paths were readable after the Windows display-path fix. A naturally missing pinned file was not created because doing so would require mutating the external QA workspace; the unavailable-item treatment remains test-covered.

### History

Collapsed and expanded states, active selection, New Chat, rename, delete, export, long-title truncation, and multiple sessions were exercised. The active QA session was left as `Phase 3C QA — Jan & Bros`. A legacy session deleted during the delete test was immediately restored from Atlas's untouched legacy persistence record and verified in the current workspace-scoped store; recoverable history was not lost.

### Settings and local/cloud state

Settings was inspected in both themes and at minimum width. Draft/save behavior changed and persisted the theme. An invalid Ollama host produced the inline validation “Enter an HTTP or HTTPS URL.” and disabled Save. The OpenRouter draft state displayed the complete cloud disclosure without saving a provider change or entering a credential. Credential presence remained boolean-only; no secret was returned or displayed. Cancel/discard, Escape, keyboard focus cycling, and navigation were exercised. The persistent header/composer destination remained `Local · Ollama`.

## C. Visual Issues Found

| Location | Severity | Observed behavior | Fix | Files changed |
| --- | --- | --- | --- | --- |
| Launcher, header, preview, Context | Medium | Rust's canonical Windows `\\?\` prefix leaked into user-facing paths, reducing trust/readability. | Added one display-only path formatter. Backend calls continue using canonical authorized paths. | `src/lib/paths.ts`, `WorkspaceHeader.tsx`, `LandingScreen.tsx`, `InlineFileViewer.tsx`, `EvidencePane.tsx` |
| Evidence/file preview | Medium | Auto-scrolling a highlighted line used `scrollIntoView`, which also scrolled the surrounding Evidence pane and clipped the file tree/header. | Scroll only the `.source-code` container by assigning its bounded `scrollTop`. | `InlineFileViewer.tsx` |
| Minimum-width header | High | The provider status disappeared because a broad `:first-child` selector matched each nested status component. Local/cloud destination was therefore not always visible. | Target only the first direct status wrapper, hiding the index item while preserving `Local · Ollama`. | `index.css` |
| Composer restraint | Low | The composer retained an unnecessary linear gradient that drifted from the restrained Phase 3A direction. | Replaced it with the semantic solid canvas surface. | `index.css` |

All four visual issues were fixed and re-inspected in the native app.

## D. Interaction Issues Found

| Location | Severity | Observed behavior | Fix | Files changed |
| --- | --- | --- | --- | --- |
| Find on Windows | Critical workflow | Similarity search escaped canonical workspace backslashes a second time in the DataFusion equality expression, so every valid result was filtered out. | Preserve Windows separators and escape only the expression's quote delimiter. Added a regression test. | `src-tauri/src/vectorstore.rs` |
| Narrow drawers | High | If History and Evidence were both persisted open before crossing the compact breakpoint, both overlays appeared at once. | On compact entry, deterministically close and persist History when both are open; normal toggle behavior remains mutually exclusive. Added a frontend regression test. | `WorkspaceLayout.tsx`, `WorkspaceLayout.test.tsx` |

Both interaction defects were fixed and verified in the running Tauri application. The preview containment fix in section C also improves interaction continuity but is counted once as a visual/scroll defect.

## E. Theme QA

### Dark

Launcher, Ask empty and answered states, Evidence, Find, Files/preview, Context, History, Settings, focused controls, selected rows, and inline status/error surfaces were inspected. Text hierarchy, dividers, code surfaces, and focus indicators remained readable without excessive glow or badge use.

### Light

Launcher, Ask, Evidence/source preview, and Settings were inspected after a real draft/save theme change. Secondary text, borders, selected rows, focus rings, warning/error colors, and code surfaces retained sufficient separation and did not look like a mechanical inversion. Dark theme was restored through the same settings path.

## F. Window-size QA

- **Large desktop:** History (248 px), center (approximately 1218 px), and Evidence (420 px) coexisted with no horizontal overflow.
- **Typical laptop:** History, a 684 px center, and Evidence remained usable. Header and composer were not clipped.
- **Minimum 1000×640:** the center retained priority; History and Evidence behaved as mutually exclusive overlay drawers after the fix. The composer remained approximately 902 px wide, provider status remained visible, source preview was usable, and the 880×555 Settings sheet retained its navigation and footer.
- **Breakpoint drag:** continuous native resizing showed no visible resize lag or horizontal layout collapse. Exact resizer-handle drag calibration was not separately measured, but retained pane widths and content continuity were observed across all three sizes.

## G. Accessibility QA

- Ask/Find tabs, suggestions, Find results, citation buttons, Evidence tabs, file-tree expansion, history controls, composer, Context removal, and Settings navigation were keyboard exercised.
- ArrowRight expanded a tree folder and exposed level-three items.
- The Settings dialog cycled focus from the footer back to its close control, closed with Escape, and restored the normal Settings trigger as the usable focus target in a keyboard flow.
- The narrow-drawer correction prevents simultaneous modal-like overlays and reduces focus ambiguity.
- The provider destination is no longer visually hidden at minimum width.
- Existing visible focus rings, semantic tabs, labels, status announcements, and reduced-motion styles remained intact.
- No keyboard trap or unlabeled critical action was observed.

## H. State QA

| State | Coverage and result |
| --- | --- |
| Healthy index | Native: factual 102 files / 567 chunks; quiet `Index ready` status. |
| Index required/running/failed | Existing Phase 3B behavioral tests passed; not destructively forced against the healthy QA index. |
| Provider unavailable / validation | Native Settings invalid-host state was persistent, inline, and disabled Save. |
| Generation success/follow-up | Native local Ollama completion and follow-up both passed. |
| Generation/cloud blocked | Existing persistent-error tests passed. No real cloud request was sent because no QA credential/authorization was provided. |
| Find success | Native, after Windows filter fix: ten results with honest metadata. |
| Find zero results | Frontend test-covered; vector nearest-neighbor semantics did not naturally return zero for the real indexed workspace. |
| File unavailable / unsupported | Existing UI/test paths retained; no QA workspace file was deleted to manufacture the state. |
| Empty and populated history | Native, including new, rename, selection, delete/restore, and export. |
| Unavailable workspace | Launcher behavioral test passed; the authorized QA workspace was available. |
| Settings unsaved/invalid | Native: cancel/discard and inline invalid-host state passed. |

Persistent failures remain inline or in durable banners/surfaces rather than toast-only.

## I. Performance Observations

No delayed typing, panel-open lag, conversation scrolling jank, file-tree expansion lag, source-preview jank after the containment fix, or obvious resize lag was observed. Find latency tracked embedding/retrieval work rather than client rendering. The final production assets were:

- JavaScript: 424.01 kB (131.30 kB gzip)
- CSS: 51.75 kB (9.71 kB gzip)

No new dependency or broad performance rewrite was introduced.

## J. Screenshots Captured

Screenshots were captured from the actual Tauri WebView2 and retained outside the repository under the user's temporary directory:

1. `%TEMP%\atlas-3c-launcher-dark.png`
2. `%TEMP%\atlas-3c-launcher-light.png`
3. `%TEMP%\atlas-3c-ask-empty-dark.png`
4. `%TEMP%\atlas-3c-ask-answer-dark.png`
5. `%TEMP%\atlas-3c-ask-evidence-dark.png`
6. `%TEMP%\atlas-3c-find-results-dark.png`
7. `%TEMP%\atlas-3c-files-dark.png`
8. `%TEMP%\atlas-3c-files-preview-dark.png`
9. `%TEMP%\atlas-3c-context-dark.png`
10. `%TEMP%\atlas-3c-history-dark.png`
11. `%TEMP%\atlas-3c-settings-dark.png`
12. `%TEMP%\atlas-3c-settings-light.png`
13. `%TEMP%\atlas-3c-ask-light.png`
14. `%TEMP%\atlas-3c-workspace-large-dark.png`
15. `%TEMP%\atlas-3c-workspace-laptop-dark.png`
16. `%TEMP%\atlas-3c-minimum-before-fix.png`
17. `%TEMP%\atlas-3c-minimum-workspace-dark.png`
18. `%TEMP%\atlas-3c-settings-minimum-dark.png`

The before-fix minimum screenshot is retained as defect evidence. No screenshot asset was added to the repository.

## K. Tests Added

- `paths.test.ts` (3 tests): strips canonical Windows drive and UNC display prefixes and leaves ordinary paths unchanged.
- `WorkspaceLayout.test.tsx` (1 additional test): persisted History/Evidence state becomes mutually exclusive in compact layout.
- `vectorstore.rs` (1 additional Rust test): workspace filter escaping preserves Windows directory separators.

Final suites: 35 frontend tests across 8 files, and 26 Rust tests. All passed.

## L. Validation Results

| Command | Result |
| --- | --- |
| `pnpm test -- --run` (`apps/desktop`) | **PASS** — 8 files, 35 tests |
| `pnpm lint` (`apps/desktop`) | **PASS** |
| `pnpm build` (`apps/desktop`) | **PASS** — TypeScript + Vite, 2009 modules |
| `cargo fmt --check` (`apps/desktop/src-tauri`) | **PASS** |
| `cargo check --all-targets` (`apps/desktop/src-tauri`) | **PASS** |
| `cargo clippy --all-targets -- -D warnings` (`apps/desktop/src-tauri`) | **PASS** |
| `cargo test --all-targets` (`apps/desktop/src-tauri`) | **PASS** — 26 passed |
| `pnpm install --frozen-lockfile` (root) | **PASS** — lockfile current |
| `pnpm build` (root Turbo) | **PASS** — 1/1 task |
| `git diff --check` | **PASS** — no whitespace errors; Git emitted only existing LF/CRLF conversion notices |
| Final native Tauri smoke launch | **PASS** — see Native Workflow Results; a final post-validation launch is recorded below |

## M. Remaining Visual/UX Issues

- Vector Find has no defensible semantic relevance threshold, so a nonsense query can still receive nearest candidates. Atlas correctly avoids presenting fake relevance, but a true weak-result state belongs to later retrieval-quality work and was not started here.
- Missing-file and unsupported-preview states were not destructively manufactured in the external QA workspace; their existing behavioral coverage passed.
- A real blocked OpenRouter payload was not transmitted because no cloud credential was configured for QA. Disclosure, local/cloud rendering, credential non-exposure, and persistent blocked-state behavior remain test-covered.
- The Evidence resize handle was observed across native window resizing, but a precision pointer-drag measurement was not recorded.

None of these limitations blocks the retained Atlas 1.0 workflow validated in this phase.

## N. Files Changed

### Phase 3C changes

- `apps/desktop/src/lib/paths.ts` (new)
- `apps/desktop/src/lib/paths.test.ts` (new)
- `apps/desktop/src/components/WorkspaceHeader.tsx`
- `apps/desktop/src/components/LandingScreen.tsx`
- `apps/desktop/src/components/InlineFileViewer.tsx`
- `apps/desktop/src/components/EvidencePane.tsx`
- `apps/desktop/src/components/WorkspaceLayout.tsx`
- `apps/desktop/src/components/WorkspaceLayout.test.tsx`
- `apps/desktop/src/index.css`
- `apps/desktop/src-tauri/src/vectorstore.rs`
- `docs/audits/atlas-phase-3c-runtime-visual-qa-report.md` (new)

### Pre-existing changes preserved

Every other modified, deleted, or untracked path shown by the pre-work `git status --short` belonged to the pre-existing user/Phase 1–3B working tree and was preserved. This includes repository workflows and configuration, README/docs, package and Cargo manifests/locks, the Phase 1/2 Rust services and tests, the Phase 2/3B frontend domain components and tests, the intentional deletion of retired product surfaces, and the prior audit/design reports. No pre-existing deletion was restored, no untracked file was cleaned, and no unrelated file was rewritten.

No Phase 4 retrieval-quality work was started. No commit or push was performed.
