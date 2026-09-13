# Atlas 1.0 UX Architecture and Interface Specification

Status: Phase 3A design specification
Implementation target: Phase 3B
Product definition: Atlas is a local-first workspace intelligence desktop app that indexes one codebase or document set, answers grounded questions with inspectable evidence, and makes every cloud transfer explicit and opt-in.

This document specifies interaction architecture, not a completed visual redesign. Statements labelled **CURRENT** describe the Phase 2 tree. Statements labelled **PROPOSED** are requirements for Phase 3B. **RATIONALE** explains the decision. Removed Phase 2 features are outside this specification and must not return.

## A. Design Executive Summary

Atlas 1.0 should feel like a quiet evidence workbench for one workspace. The stable center is a two-mode query surface: **Ask** synthesizes an answer from workspace evidence; **Find** returns evidence directly. History is a collapsible left surface. Evidence, files, source preview, and pinned context share one contextual right surface. Infrastructure—indexing, providers, privacy, and settings—stays visible when consequential and quiet when healthy.

The primary loop is:

```text
Open Workspace
      |
      v
Check index readiness --needs work--> Index / recover
      |
      v
Choose Ask or Find
      |
      +---- Ask ----> grounded response ----+
      |                                     |
      +---- Find ---> ranked evidence -------+--> inspect source
                                                  |
                                     pin / ask follow-up
                                                  |
                                                  +----> Ask
```

There are only two product-level locations: **Launcher** and **Workspace**. Ask and Find are workspace modes. History, Evidence & Files, Context, and Settings are panels or sheets, not competing destinations. Atlas remains a Tauri single-page application; browser routing is unnecessary.

The distinguishing visual idea is an **evidence ledger**: restrained source markers and a consistent evidence-blue rule connect an answer or search result to the source being inspected. It supplies provenance continuity without turning the app into an IDE, dashboard, or decorative AI interface.

## B. Atlas 1.0 UX Principles

1. **The workspace is the unit of trust.** Its name, root, index, history, context, and provider state must never appear to bleed into another workspace.
2. **Evidence is adjacent, not interruptive.** Routine source inspection preserves the Ask conversation or Find results on screen whenever width permits.
3. **Ask and Find are explicit siblings.** Atlas never guesses which mode the user intended.
4. **Local and cloud describe an actual destination.** Use “Local · Ollama” and “Cloud · OpenRouter,” not vague privacy branding.
5. **Healthy infrastructure is quiet.** Index and provider failures are prominent; healthy state is compact.
6. **Manual context is visible.** A question influenced by pinned files must never look context-free.
7. **Models support the task.** Model selection belongs in settings; the composer shows destination, not a playground.
8. **Persistent failures have persistent UI.** Toasts may acknowledge a transient action but cannot be the only error representation.
9. **Facts only.** Do not invent confidence, index coverage, token precision, progress precision, or model readiness.
10. **The center wins.** On constrained windows, the query surface remains usable and secondary surfaces become overlays.
11. **Desktop density with readable prose.** Paths and metadata are compact; answers, source excerpts, and controls retain comfortable reading and target sizes.
12. **Removal is durable.** Graphs, analytics, personas, agents/actions, overlay chat, vision, web search, Timeline, command palette, context slots, Zen Mode, accent customization, model routing, and updater prompts must not reappear.

## C. Product Navigation Model

### Final hierarchy

```text
Launcher

Workspace
  Ask                         primary mode
  Find                        primary mode

Contextual surfaces
  History                     left rail / drawer
  Evidence & Files            right pane / drawer
    Sources
    Files
    Context
  Settings                    application sheet
```

**CURRENT:** [App.tsx](../../apps/desktop/src/App.tsx) switches directly between the launcher and one authorized workspace. [WorkspaceLayout.tsx](../../apps/desktop/src/components/WorkspaceLayout.tsx) already owns Ask/Find mode and modal/panel visibility; there is no router.

**PROPOSED:** Preserve this state-based SPA model. Represent the product location as a small discriminated state (`launcher` or `workspace`) and the workspace mode as `ask` or `find`. History and Evidence are independently addressable panel states on wide windows and mutually exclusive drawers at minimum width. Settings is a focus-trapped sheet over either Launcher or Workspace.

**RATIONALE:** There is no valuable browser deep-link behavior in a local, one-window workspace tool. Explicit state avoids route ceremony and keeps workspace authorization/lifecycle in one place.

Navigation priority is:

1. active workspace identity;
2. Ask/Find switch;
3. query input;
4. evidence inspection;
5. history and settings;
6. infrastructure detail.

## D. Launcher Specification

### Current assessment

**CURRENT:** [LandingScreen.tsx](../../apps/desktop/src/components/LandingScreen.tsx) provides recent workspace rows, folder selection, Ollama checks, embedding-model selection, initial indexing progress, removal from recents, and entry into a workspace. It structurally preserves the correct open/index sequence. It also centers model setup in the new-workspace form, represents missing authorization with a transient toast, and uses a decorative card/glow presentation. Recent rows rely mainly on persisted `indexedAt` rather than live `IndexHealth`.

**PRESERVE:** recent workspaces, explicit Open Workspace, inline initial index flow, removal wording that distinguishes launcher removal from data deletion, and immediate entry after successful indexing.

**REPOSITION:** embedding prerequisites belong in the indexing step, not the launcher’s default center. Settings moves to the top-right utility area.

**DE-EMPHASIZE:** branding, version, provider detail, and historical timestamps.

### Proposed layout

```text
+--------------------------------------------------------------------+
| Atlas                                             Settings          |
|                                                                    |
| Workspaces                                      [Open workspace...] |
| Open one codebase or document set.                                  |
|                                                                    |
|  atlas-docs             Ready                    Open     (...)      |
|  C:\work\atlas-docs    Indexed Aug 22 · 412 files                  |
|  ----------------------------------------------------------------  |
|  legacy-api             Folder missing           Locate    (...)    |
|  D:\archive\legacy-api                                              |
|                                                                    |
|  No decorative model/setup panel. Problems expand in their row.     |
+--------------------------------------------------------------------+
```

- Use a restrained list, not a grid of dashboard cards. Each row shows name, compact display path, availability, factual index state, last completed index time when known, and file count when live data exists.
- The primary action is **Open** for a ready workspace, **Index** for a known unindexed workspace, **Locate** when the root is missing or authorization was lost, and **Resume indexing** only if the backend actually exposes a resumable job (it currently does not).
- The row overflow menu contains **Remove from launcher**. Its confirmation says index/history data is retained. No purge action is implied.
- **Open workspace…** invokes the native folder picker. After selection, the launcher shows an indexing prerequisite step inside the content area; it does not resemble onboarding.
- Settings is an icon/button in the application header. Model configuration appears only if a prerequisite fails or the user opens Settings.

### Launcher states

- **No recents:** concise explanation (“Open a folder to index and ask questions about it”), one Open Workspace button, and no sample projects or marketing carousel.
- **Missing path:** persistent row status “Folder missing” with Locate and Remove. Do not use a toast alone.
- **Unauthorized/unavailable:** persistent row status “Access required” or “Workspace unavailable,” based on a backend reason. Let the user reselect the folder.
- **Unindexed:** “Index required,” selected embedding model if known, and an Index action.
- **Stale/incompatible:** “Index rebuild required” and the actual reason, with Rebuild action.
- **Index failed:** inline error summary and Retry; Details may open the indexing status region.

**Phase 3B contract requirement:** the current `is_workspace_authorized` boolean cannot distinguish missing, inaccessible, and authorization-lost roots. Add a launcher-facing `WorkspaceSummary` query (or equivalent) returning canonical workspace ID, availability reason, and live `IndexHealth`. Until that exists, do not infer “missing” from a generic false result.

## E. Workspace Shell Specification

### Current assessment

**CURRENT:** [WorkspaceLayout.tsx](../../apps/desktop/src/components/WorkspaceLayout.tsx) keeps one active workspace and exposes Ask/Find, indexing refresh, provider state, settings, history, and file access. It currently reserves 256 px for history and 288 px for the file/context sidebar at all times, puts verbose index/model facts in the header, and opens file preview in a full-screen modal.

**PRESERVE:** one active workspace, top-level Ask/Find switch, index refresh, provider destination, settings access, and non-destructive return to launcher.

**MERGE:** the current file tree, pinned list, citation inspection, and preview become Evidence & Files.

**MAKE CONTEXTUAL:** expanded history, evidence, model names, Git detail, full index metrics, and settings.

### Default workspace layout

```text
+--------------------------------------------------------------------------+
| [≡] atlas  /  C:\work\atlas       Ready       Local · Ollama    [⚙] [⇄] |
|        [ Ask ]  [ Find ]                                                   |
+----+---------------------------------------------------------------------+
| H  |                                                                       |
| i  |                         Ask or Find                                    |
| s  |                                                                       |
| t  |                                                                       |
|    |                                                                       |
| +  |                                                                       |
+----+---------------------------------------------------------------------+
|     center query surface always receives priority                         |
+--------------------------------------------------------------------------+
```

The compact header has four zones:

1. history control plus workspace name; path is secondary and truncates in the middle with full path tooltip;
2. Ask/Find segmented switch;
3. compact index state and exact generation destination;
4. Evidence, Settings, and Switch Workspace controls.

“Ready” may be a subdued status dot plus accessible text. Problems expand into an inline status strip directly below the header. The healthy state must not show file/chunk counts continuously; those belong in the Index detail popover or Settings.

Switch Workspace returns to Launcher without removing the workspace. Any unsent draft stays with its workspace UI state during that application session; persisted draft behavior is not required.

## F. Ask Specification

### Conversation and history behavior

**CURRENT:** [useWorkspaceChat.ts](../../apps/desktop/src/features/ask/useWorkspaceChat.ts) streams into a workspace-scoped session, retains evidence per assistant message, builds bounded context, supports real stop, and disables session mutations during generation. Errors are currently toast-only and stopped/failed are not explicit persisted message states.

**PROPOSED:** each turn renders:

- user message with sent destination metadata only when useful;
- assistant answer with a narrow evidence rule and a **Sources N** affordance when evidence exists;
- optional persistent inline status for stopped, failed, no-evidence, or cloud-blocked outcomes;
- follow-up suggestions only when produced by real retained behavior; they are visually secondary and never presented as generated insight cards.

Evidence remains associated with the assistant message that used it. Clicking **Sources N** opens Evidence on that message’s sources without changing the active session or scroll position. System events appear as compact inline notices, never as simulated chat personas.

### Empty state

Show:

- workspace name and factual readiness (“Index ready” or the blocking index/provider state);
- one sentence: “Ask a question about this workspace, or switch to Find for direct source matches.”;
- at most three stable functional examples such as “Where is workspace authorization enforced?”, “Explain the indexing flow,” and “Find the document that defines release steps.” These are templates, not workspace-derived claims;
- up to three recent workspace sessions when history exists.

Do not show a giant slogan, AI artwork, fabricated summary, trending prompts, analytics, or provider picker.

### Composer

- Anchored to the bottom of Ask with the conversation scrolling behind no content.
- Starts as a single comfortable line and grows to a maximum of approximately six text lines; beyond that it scrolls.
- `Enter` sends and `Shift+Enter` inserts a newline. While IME composition is active, Enter must not send.
- Left accessory: Context count, e.g. **Context · 2 files**, opening the Context tab.
- Right status: exact destination, **Local · Ollama** or **Cloud · OpenRouter**. The selected model is available in tooltip/details, not a dominant dropdown.
- Primary trailing control is Send; it changes to Stop only while generation is cancellable.
- Disable sending when the workspace needs an index, generation provider is unavailable, required model is invalid, or the query is blank. The nearby inline explanation must state why.
- Preserve a draft while switching Ask/Find within the same workspace and active session.

### Generation states

- **Generating:** reserve answer space, show a small live status and streaming content; announce start and completion politely to assistive technology.
- **Stopped:** retain partial text and mark “Stopped”; offer Retry. Do not claim completion.
- **Failed:** retain the user message, display a structured inline error below it, and offer Retry after configuration/recovery.
- **No evidence:** if the backend can only report zero results, say “No workspace sources were returned,” not “nothing relevant exists.” Local generation may proceed only according to the retained backend policy.
- **Cloud blocked:** see section M; nothing is sent and the failure persists with that turn.

**Phase 3B contract requirement:** add a frontend message lifecycle field (`streaming | complete | stopped | failed`) and structured `AppError` association. This can be implemented in the workspace persistence layer without changing the generation transport.

## G. Find Specification

### Current assessment

**CURRENT:** [useWorkspaceEvidence.ts](../../apps/desktop/src/features/evidence/useWorkspaceEvidence.ts) keeps an ephemeral query/result set, returns stable `EvidenceResult` objects, and supports pinning and source opening. Find currently renders cards in the main surface and uses the full-screen file modal. It does not create chat history.

### Proposed behavior

- Ask and Find are two tabs in the same primary region. `Ctrl+1` selects Ask; `Ctrl+2` selects Find.
- Find has its own focused, single/multiline-short search field and explicit Find action. Enter searches; Shift+Enter is not necessary unless a multiline field is retained.
- Switching to Find preserves the active Ask session, its scroll position, and draft. Switching back restores them. Find queries do not create chat sessions.
- Results remain in the center as a ranked list. Each result shows display path, 1-based inclusive line range, source snippet, and only metadata present in `EvidenceResult`. Do not show raw vector distance as confidence.
- Selecting a result opens it in Evidence without replacing the result list.
- Each result offers **Pin** and **Ask about this**. Ask about this pins the source (unless already pinned), switches to Ask, and prefills a concise draft referencing the source. It never auto-sends.
- A result’s source path can be copied from its overflow menu.

Find states are blank instruction before the first query, visible progress while searching, a dedicated no-results state, and persistent inline failure. Preserve the last successful results if a later search fails; show the failure above them as stale results.

## H. Evidence & Files Specification

### One domain, three views

**CURRENT:** [FileTree.tsx](../../apps/desktop/src/components/FileTree.tsx), [InlineFileViewer.tsx](../../apps/desktop/src/components/InlineFileViewer.tsx), citation chips in `WorkspaceLayout`, and pinned files currently form separate navigation patterns. `api.ts` receives file content through workspace-authorized IPC but discards `totalLines`. Source ranges are already public 1-based inclusive ranges.

Phase 3B should consume the Phase 2 evidence contract without presentation-specific reinterpretation:

```ts
type EvidenceResult = {
  id: string;
  workspaceId: string;
  filePath: string;
  displayPath: string;
  lineStart: number; // 1-based, inclusive
  lineEnd: number;   // 1-based, inclusive
  content: string;
  snippet: string;
  sourceType: "workspace_file";
};
```

Every result must match the active canonical workspace ID before rendering. There is deliberately no public confidence, raw distance, freshness, or inferred relevance field.

**PROPOSED:** a single **Evidence** pane contains tabs:

- **Sources** — sources for the selected assistant message or selected Find result;
- **Files** — the workspace file tree and direct preview;
- **Context** — the active chat’s pinned/manual context basket.

### Evidence-open wide layout

```text
+-------------------------------------------------------------------------+
| atlas                     [ Ask ] [ Find ]       Ready  Local · Ollama   |
+----+-------------------------------------------+------------------------+
| H  | Conversation / Find results               | Sources | Files | Ctx  |
| i  |                                           |------------------------|
| s  | Answer with source marker 1 ─────────────>| 1  src/indexer.rs      |
| t  |                                           |    lines 84–118        |
|    | Follow-up remains visible                  |------------------------|
| +  |                                           | source preview         |
|    |                                           | 84  ...                 |
|    |                                           | 85  highlighted range   |
+----+-------------------------------------------+------------------------+
|                  composer                      | Pin · Copy path · Close |
+-------------------------------------------------------------------------+
```

### Pane rules

- Closed by default until the user clicks a citation, Find result, file, Context indicator, or Evidence control. It does not auto-open merely because an answer has sources.
- Citation or result selection opens Sources and selects that source automatically.
- The pane shows a source list above or beside preview based on height. Multiple sources have previous/next controls and keyboard selection.
- Preview shows display path, exact 1-based inclusive range, code/text with line numbers, and a highlighted requested range. “Open full file” means show the full authorized file in this pane—not launch an IDE.
- Actions: Pin/Unpin, Copy path, Copy selected source text. Content copying is explicit; nothing is silently placed on the clipboard.
- Files tab is a keyboard-operable tree. Selecting a file previews it in the same pane; directories only expand/collapse.
- Missing files show a persistent “File no longer exists” state with Remove from context when applicable. A range outside current bounds says “This source range changed since indexing” and offers Refresh Index plus an unhighlighted current preview if available.
- Unsupported preview shows file metadata and “Preview unavailable for this file type”; it does not imply the file was indexed unless index metadata says so.
- Routine inspection is never a modal. Settings and destructive confirmations remain dialogs/sheets.

**Phase 3B contract requirement:** retain `totalLines` from the existing read-file response in `api.ts`. Add preview capability/unsupported-reason metadata only if the backend can determine it truthfully; otherwise derive support from the existing documented formats and label it as a UI limitation.

## I. Context Basket Specification

**CURRENT:** `ChatSession.manualContext` in [chats.ts](../../apps/desktop/src/lib/chats.ts) is an array of authorized file paths owned by the active workspace session. [useWorkspaceHistory.ts](../../apps/desktop/src/features/history/useWorkspaceHistory.ts) migrates and persists workspace-scoped sessions. The backend enforces bounded, Unicode-safe character budgets, but does not expose an exact token count or assembly receipt.

**PROPOSED mental model:** Context is a per-chat basket of files the user deliberately asks Atlas to consider in addition to retrieved evidence.

- Show **Context · N files** in the composer at all times when `N > 0`; when empty, the control reads Context without a badge.
- Opening it selects the Context tab in Evidence.
- Each row shows display path, file type when known, availability, and Remove. Do not display an invented token count.
- Provide Clear all with a confirmation only when the basket is non-empty; clearing does not delete files.
- A missing/unreadable item remains visible with a warning until the user removes it. The request path must exclude it and surface that exclusion rather than silently pretending it was included.
- Persistence remains **per chat**, not merely per workspace, because this is the implemented Phase 2 ownership model. New Chat starts with an empty basket. Opening a prior chat restores its basket. Workspace switching cannot carry paths across.
- Find results, Files, and Sources can all be pinned through the same action.
- Copy should say that context is bounded during prompt construction. Until an actual assembly receipt exists, show only reliable values such as file count and optionally raw file sizes if fetched.

**Phase 3B contract option:** a `ContextAssemblySummary` returned with generation could expose which sources were included/excluded/truncated and approximate character use. Do not block the core redesign on this; without it, avoid precise usage UI.

## J. History Specification

**CURRENT:** history is correctly workspace-scoped and persists active session, rename, delete, export, and new chat. It occupies a permanent 256 px sidebar. Rename uses double-click and delete is hover-only. Branching has been removed.

**PROPOSED:** History is a collapsible left rail on wide windows and a non-modal drawer on constrained windows.

- Default to the compact rail (approximately 48 px), with clear History and New Chat buttons. Persist expanded/collapsed preference as UI state, not workspace domain state.
- Expanded width is approximately 248 px. Group sessions by Today, Previous 7 days, and Earlier using existing timestamps. Do not add empty groups.
- Highlight the active session with more than color alone.
- Each row uses a visible overflow menu for Rename, Export, and Delete. No double-click-only or hover-only actions.
- New Chat creates and activates a blank workspace-owned session with empty manual context.
- Empty history shows one line and New Chat. Migration/corruption recovery is a persistent panel notice with recoverable sessions retained; do not silently clear storage.
- During generation, switching/mutating sessions stays disabled if needed to preserve the current stream/session invariant. Explain this in the disabled control tooltip.
- Branch does not return.

History should not auto-open at launch. The empty Ask view may show a short recent-session list as a convenience; selecting one opens it without requiring the rail to stay expanded.

## K. Indexing & Health Specification

### Current contract

**CURRENT:** [useWorkspaceIndex.ts](../../apps/desktop/src/features/indexing/useWorkspaceIndex.ts) combines event updates with job queries and five-second health polling. The Rust `IndexHealth` exposed through [api.ts](../../apps/desktop/src/lib/api.ts) truthfully provides status (`not_indexed`, `queued`, `running`, `ready`, `failed`), file count, chunk count, embedding model, last completed time, and error. Watchers maintain changed files. There is no cancellation, pending-change count, explicit stale state, or supported-file preflight before a job starts.

### Placement

- Healthy/current: compact header state “Ready” with tooltip/popover for files, chunks, embedding model, and completion time.
- Running/queued: header progress state plus a persistent strip below the header. Show processed/total files only when the job reports both. Never interpolate false percentages.
- Required/failed/incompatible/provider unavailable: persistent action strip. Ask and Find explain why they are disabled.
- Detailed index state and Refresh/Rebuild actions also live in Settings > Indexing.

### Required states and actions

| State | User-facing treatment | Primary recovery |
|---|---|---|
| Never indexed | Dedicated workspace center state or launcher inline step | Check provider, choose embedding model, Index |
| Queued | Status strip: waiting to index | None; no fake cancel |
| Indexing | Actual file progress and chunks when available | Stop shown only if real cancellation is added |
| Ready/current | Quiet header status | Optional Refresh in detail menu |
| Changes pending | Show only if backend exposes it reliably | Wait for watcher or Refresh |
| Stale/incompatible | Persistent warning with old/new model reason | Rebuild Index |
| Failed | Persistent error, last valid index remains identified if usable | Retry; open details/settings |
| Embedding unavailable | Provider/model-specific error | Open Models & Privacy |
| Rebuild required | Blocking warning before retrieval if data is incompatible | Rebuild after confirmation |

Initial indexing shows prerequisite checks (authorized root, Ollama reachable, embedding model available), embedding model, actual supported-file count if a preflight contract exists, job state, actual progress, completion summary, and actionable failure. Since the backend has no cancellation, Phase 3B must not add a Cancel button unless end-to-end cancellation is implemented first.

**Phase 3B contract requirement:** if “changes pending,” incompatibility reason, or supported-file count is desired, extend `IndexHealth`/add preflight. The current UI may reliably infer only an embedding-model mismatch between workspace configuration and the ready index; it must not call arbitrary watcher delay “stale.”

## L. Models & Provider Specification

Atlas has two separate infrastructure contracts and the UI must retain that separation.

### Embedding

- Provider: Ollama for the retained implementation.
- Model: workspace/index configuration.
- Readiness: host reachable and exact model available.
- Compatibility: a changed embedding model requires a rebuild before the new configuration is current.
- Placement: Settings > Models & Privacy for host/readiness; Settings > Indexing for the indexed model and compatibility. It does not appear in the composer.

### Generation

- Provider: local Ollama or explicitly enabled OpenRouter.
- Model: selected per workspace, not per message.
- Readiness: Ollama host/model or stored OpenRouter credential and selected model.
- Placement: exact destination in header and composer; model name in its details popover; editing in Settings only.

**CURRENT:** [SettingsModal.tsx](../../apps/desktop/src/components/SettingsModal.tsx) already separates generation provider/model from the embedding model. [settings.ts](../../apps/desktop/src/lib/settings.ts) and workspace persistence scope generation choices per workspace. Current readiness is largely Ollama health or credential presence rather than verified model/key validity.

**PROPOSED:** remove routine model dropdowns from primary interaction. A destination control opens a compact explanation and link to settings; it is not a quick model switcher. Invalid models produce `InvalidModel` inline in Settings and a concise blocked-composer message.

## M. Cloud & Privacy Specification

### Initial enabling

The first time OpenRouter is enabled for a workspace, show a focused disclosure sheet:

> OpenRouter generation sends the complete request to OpenRouter. Depending on the question, that request can include your question, retrieved workspace excerpts, pinned files, relevant conversation history, system instructions, and Git context when enabled. Atlas inspects the complete outbound payload locally and blocks it if the outbound policy detects a secret.

The sheet includes credential entry/status, selected model, Git-context state, a link to the full explanation, **Enable OpenRouter for this workspace**, and Cancel. Consent is workspace-scoped and versioned so a material disclosure change can be shown again. Never return or display the stored full key after it is accepted.

### Persistent state

- Header and composer say **Local · Ollama** or **Cloud · OpenRouter**.
- Cloud uses a restrained cloud icon plus text; local/cloud cannot be distinguished by color alone.
- The detail popover repeats the categories that may be sent and offers Change in Settings.

### Per request

**CURRENT:** `useWorkspaceChat.ts` uses `window.confirm` on every OpenRouter send, then passes the backend’s per-request `allowCloud` authorization. The backend constructs and scans the complete payload authoritatively.

**PROPOSED:** after the workspace disclosure has been accepted, the composer’s explicit **Send to OpenRouter** label/accessible name authorizes that single request; the call still sends `allowCloud: true` for that request. Do not show a repetitive scary confirmation. Interrupt only when:

- OpenRouter has not been enabled for this workspace;
- the credential/model is missing or invalid;
- the disclosure version materially changed;
- provider state changed while a draft was open;
- the outbound policy blocks the complete payload.

### Blocked payload

Render a persistent inline turn error and an accessible alert:

> **Request not sent.** Atlas found sensitive content in the complete OpenRouter payload. Nothing was sent to OpenRouter.

If the typed backend error safely identifies a category, add it without echoing secret material. Actions: Review context, Switch to Local, Dismiss. There is no override in Phase 3B. A toast may announce the block but is never the sole representation.

The interface must never imply that only the typed question is inspected. It must also never use “Privacy Mode,” “Secure AI,” or “Safe Cloud.”

## N. Settings Specification

### Container and navigation

Use a large application sheet (roughly 760–880 px wide within the window) with a left navigation list and a scrollable detail region. On minimum width it becomes a nearly full-window dialog. It traps focus, restores focus to its opener, and closes on Escape only when no destructive confirmation is active.

The four sections are:

1. **General** — System/Light/Dark theme and real application behavior only.
2. **Models & Privacy** — Ollama host, embedding readiness, generation provider/model, OpenRouter credential status, workspace cloud authorization, exact cloud disclosure.
3. **Indexing** — factual health, indexed embedding model, compatibility, watcher behavior, supported formats where documented, Refresh/Rebuild.
4. **Advanced** — additional instruction if retained, diagnostics, version/build, and explicit “Automatic updates unavailable: signing is not configured.”

### Form behavior

- Use a draft model with Save and Cancel rather than partially applying unrelated fields on change. Theme may preview immediately but reverts on Cancel.
- Show dirty state near the footer and confirm before closing with unsaved changes.
- Validate fields beside the field. A persistent connection/model failure also appears in the section summary.
- “Test connection” reports verified reachability; saving a syntactically valid host is not labelled “Connected.”
- Credential storage shows Stored/Not stored and Replace/Remove; never reveal the stored value.
- Rebuild Index is separated as a consequential action and confirms that the current index will be replaced, while noting Phase 1 failure safety.
- No accent, Zen, context slots, personas, multi-model routing, agent/tool, web, vision, overlay, Timeline, graph, analytics, or updater-enable settings.

**CURRENT:** `SettingsModal.tsx` already has the correct four semantic tabs but is a compact modal with immediate-ish local state and limited inline validation. Preserve the grouping, replace the presentation and error behavior.

## O. Git Context Specification

**CURRENT:** the generation flow fetches `GitContext` (branch, uncommitted files, recent commits, diff summary) and includes it when the root is a Git repository. There is no visible control or indication.

**PROPOSED:** Git is a small context source, never primary navigation.

- Show branch and a compact changed-file count in Evidence > Context details when available.
- Add a workspace setting **Include Git context in Ask**. For migrated workspaces, preserve current behavior by defaulting it on; new-workspace copy must make this visible.
- When on, the composer’s Context details say “Git context included.” The user can turn it off without leaving the draft through a link to the Context tab or settings.
- In Cloud mode, initial disclosure and destination details explicitly list Git context if enabled.
- For non-Git workspaces, omit routine Git UI. Settings may say “This workspace is not a Git repository.”

This toggle can initially be frontend/workspace persistence that simply skips `fetchGitContext`; it does not require a new Git backend abstraction.

## P. Window & Panel Behavior

Recommended minimum Tauri content size is **1000 × 640 px** (the current configuration is 1000 × 600). Atlas is desktop-only; no mobile layout is specified.

| Window | History | Center | Evidence |
|---|---|---|---|
| Wide, ≥1320 px | 48 px rail; expands to 248 px | Minimum 600 px, takes remaining space | 400–480 px side pane when open; resizable 360–520 px |
| Laptop, 1100–1319 px | Compact rail; expanded as overlay drawer | Always primary | 360 px side pane only if center stays ≥600 px; otherwise overlay |
| Minimum, 1000–1099 px | Overlay drawer | Full available width | Overlay drawer; mutually exclusive with History |

### Narrow-window behavior

```text
+--------------------------------------------------------------+
| [History] atlas       Ask | Find       Cloud · OpenRouter [E] |
+--------------------------------------------------------------+
|                                                              |
|                 center query surface                         |
|                                                              |
|                                                              |
+--------------------------------------------------------------+
| composer                                                     |
+--------------------------------------------------------------+

After [E]:
+--------------------------------------------------------------+
| preserved center (partly covered)| Evidence drawer       [x]  |
|                                 | Sources | Files | Context  |
|                                 | source preview              |
+--------------------------------------------------------------+
```

- The center never shrinks below readable interaction width to keep both side panels visible.
- In minimum mode, opening Evidence closes History and vice versa. Escape closes the open drawer and returns focus to the trigger.
- Source preview remains inside the Evidence drawer and may use most of the window width; it is still not a modal dialog.
- Persist evidence width and history collapsed/expanded preference locally as presentation state. Do not persist an overlay as open across restarts.
- Resizing across a breakpoint preserves selected citation/file and restores the appropriate pane without losing Ask/Find state.

## Q. Keyboard & Accessibility

### Keyboard model

| Shortcut | Action |
|---|---|
| `/` | Focus the active Ask composer or Find input when focus is not in an editor/input |
| `Enter` | Send Ask / execute Find |
| `Shift+Enter` | Newline in Ask composer |
| `Ctrl+1` | Switch to Ask |
| `Ctrl+2` | Switch to Find |
| `Ctrl+N` | New chat in the active workspace |
| `Ctrl+Shift+H` | Toggle History |
| `Ctrl+Shift+E` | Toggle Evidence |
| `Escape` | Close the topmost menu, drawer, or sheet; never implicitly stop generation |
| Arrow keys + Enter | Navigate/activate file tree, citation list, and Find result list where focus is within that widget |

Shortcuts must avoid OS-reserved conflicts where Tauri/platform behavior differs; menu labels/tooltips disclose only shortcuts actually wired. The removed command palette does not return.

### Accessibility expectations

- Every icon button has a stable accessible name and tooltip; tooltips are supplementary.
- Focus is clearly visible on both light and dark surfaces and never relies on glow.
- Settings and confirmations trap focus and restore it. Drawers use labelled complementary regions and sensible focus movement, not dialog semantics when non-modal.
- File browser uses `tree`, `treeitem`, levels, selected state, and `aria-expanded`, with conventional arrow behavior.
- Ask, Find, History, and Evidence regions have headings/labels usable by landmarks. F6 region cycling may be added if tested across platforms.
- Index/generation progress uses `aria-live="polite"`; persistent failures use `role="alert"` on first appearance without repeatedly re-announcing.
- Text and interactive states meet WCAG AA contrast. State never depends on hue alone.
- Respect `prefers-reduced-motion`; all functions remain understandable with motion disabled.
- Touch targets are not the priority, but pointer targets should generally be at least 32 px and critical controls 36–44 px.

## R. Complete State Matrix

| Domain | State | Treatment | Recovery / next action |
|---|---|---|---|
| Launcher | No recent workspaces | Dedicated centered empty state, one primary action | Open workspace |
| Launcher | Missing path | Persistent row warning | Locate or Remove from launcher |
| Launcher | Unavailable/access denied | Persistent row warning with reason | Re-authorize folder |
| Launcher | Loading recents | Stable row skeletons, not spinner-only page | Wait; inline failure if load fails |
| Index | Required | Dedicated blocker in workspace/launcher | Validate embedding provider, Index |
| Index | Queued | Header strip | Wait |
| Index | Running | Header strip with factual counters | Wait; no Cancel without contract |
| Index | Ready | Quiet compact header status | Details/Refresh optional |
| Index | Changes pending | Warning only with reliable backend state | Wait for watcher or Refresh |
| Index | Failed | Persistent strip plus Settings detail | Retry / fix provider |
| Index | Embedding unavailable | Persistent blocker with provider/model name | Open Models & Privacy |
| Index | Stale/incompatible | Persistent warning; retrieval blocked if unsafe | Rebuild Index |
| Ask | Empty | Workspace-specific functional guidance | Type question / open recent chat |
| Ask | Generating | Streaming answer and Stop | Stop or wait |
| Ask | Stopped | Partial answer marked Stopped | Retry |
| Ask | Provider error | Inline turn error plus header problem if persistent | Retry / Settings |
| Ask | Zero sources | Inline factual note “No workspace sources were returned” | Refine / Find |
| Ask | Cloud payload blocked | Inline alert; nothing-sent statement | Review context / switch Local |
| Ask | Cancel requested | Stop remains busy until backend confirms cancellation | Wait for confirmation |
| Find | Empty query | Instructional blank state | Enter terms |
| Find | Searching | Inline progress preserving prior results if any | Wait |
| Find | No results | Dedicated list empty state | Refine terms / Ask |
| Find | Failed | Persistent inline error; previous results marked retained | Retry |
| Evidence | Loading file | Preview skeleton with selected source header stable | Wait |
| Evidence | Missing file | Persistent preview state | Refresh index / unpin |
| Evidence | Stale range | Warning over current preview | Refresh index |
| Evidence | Unsupported preview | Metadata-only state | Copy path |
| Evidence | No selected source | Brief instruction within pane | Select source/file |
| Context | Empty | One-line explanation | Pin from Find/Files/Sources |
| Context | Item unavailable | Warning on item; excluded status | Remove / locate via workspace recovery |
| History | Empty | Compact state and New Chat | New chat |
| History | Persistence migrated | Quiet; no celebratory UI | None |
| History | Persistence corrupt/recovered | Persistent recoverability notice | Export recoverable data / dismiss after acknowledgement |
| Settings | Invalid Ollama host | Inline field error and section status | Correct / Test connection |
| Settings | Unavailable model | Inline model error | Refresh models / select valid model |
| Settings | Invalid cloud credential | Inline credential status | Replace credential |
| Settings | Unsaved changes | Footer dirty state | Save / discard confirmation |
| Workspace | Root unavailable after open | Blocking strip; keep session/history visible but disable file operations | Return to Launcher / reauthorize |

Toasts are reserved for short confirmations such as “Path copied,” “Session exported,” or “Removed from launcher.” They cannot carry the only copy of a failure or recovery action.

## S. Visual Direction

### Character

Calm, modern, desktop-native, serious, developer-oriented, evidence-focused, and dark-first with an equally deliberate light mode. The product should resemble a precise reading and investigation tool, not an AI dashboard.

The evidence ledger is the sole distinctive motif: numbered source markers and a thin evidence-blue line create continuity among response, result, source list, and preview. It is functional, not decorative.

### Conceptual tokens

These values give Phase 3B a concrete starting point; final contrast must be measured in implementation.

| Role | Dark | Light |
|---|---|---|
| Canvas | `#101214` | `#F4F5F6` |
| Surface | `#171A1D` | `#FFFFFF` |
| Raised surface | `#1E2226` | `#ECEFF1` |
| Divider | `#2B3035` | `#D6DADF` |
| Primary text | `#E8EAED` | `#1C2024` |
| Evidence/action blue | `#6EA8C9` | `#2F6F95` |

Semantic green, amber, and red are reserved for success, attention, and failure. Provider state must still include text/icon. Avoid gradients, glowing borders, decorative transparency, fake terminal chrome, excessive pills, and KPI cards.

- UI type: `"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif`.
- Code/path type: `ui-monospace, SFMono-Regular, Consolas, monospace`.
- Typical UI text: 13 px; conversation/source prose: 15–16 px; metadata: 12 px. Avoid uppercase micro-labels and excessive letter spacing.
- Base spacing unit: 4 px. Common gaps: 8, 12, 16, 24 px. Dense lists use 32–36 px rows; primary controls use 36–44 px height.
- Radius hierarchy: 4 px for small fields, 6 px for controls, 8 px for panels/dialogs. Avoid nested rounded cards.
- Hierarchy comes from surface level, separator, typography, and whitespace—not shadows everywhere. Use subtle shadow only for overlays/sheets.
- Motion lasts approximately 120–180 ms for panels, selection, and progress changes. No load-in theatrics, pulsing ornaments, or decorative animation.

The current indigo gradients, ambient glows, glass surfaces, large radii, and animated branding in [index.css](../../apps/desktop/src/index.css) should be retired during Phase 3B without changing functional hierarchy prematurely.

## T. Component Inventory

The 18 major implementation components below are boundaries, not a mandate for one file each. Common primitives follow them and are not counted as major domain components.

| Component | Responsibility and major state/props | Scope | Accessibility / major states |
|---|---|---|---|
| `AppShell` | Product location, active workspace, panel breakpoints, settings visibility | Domain | Landmarks; launcher/workspace/loading/unavailable |
| `WorkspaceLauncher` | Recent summaries, open flow, empty/error state | Domain | Heading/list; loading/empty/failure |
| `WorkspaceRow` | Availability, index summary, Open/Locate/Index/menu | Reusable in launcher | Named actions; ready/missing/unindexed/failed |
| `WorkspaceHeader` | Identity, mode, compact health/destination, panel controls | Domain | Labelled header; narrow/normal/problem strip |
| `QueryModeSwitch` | Explicit Ask/Find selection | Reusable domain control | Tablist/tab semantics; keyboard selection |
| `AskView` | Conversation, empty state, turn lifecycle/evidence links | Domain | Log/region; empty/generating/stopped/failed |
| `Composer` | Draft, submit/stop, destination, context indicator | Reusable within Ask | Labelled textarea; IME, disabled, multiline, cloud/local |
| `FindView` | Query, ranked results, open/pin/Ask transition | Domain | Search region/list; blank/loading/no-results/failed |
| `HistoryPanel` | Scoped sessions and actions | Domain | Labelled navigation; rail/drawer/empty/blocked-by-stream |
| `EvidencePane` | Sources/Files/Context tabs, selected preview, pane sizing | Domain | Complementary region; closed/pane/drawer/no-selection |
| `CitationList` | Message/result evidence selection and navigation | Reusable domain | Listbox/list; multiple/missing/stale |
| `SourcePreview` | Authorized content, ranges, copy/pin/full file | Reusable domain | Code region; loading/ready/missing/stale/unsupported |
| `FileBrowser` | Authorized workspace tree and file selection | Domain | Full tree keyboard model; loading/empty/error |
| `ContextBasket` | Active-chat pinned files, Git inclusion, remove/clear | Domain | List/status; empty/unavailable/bounded-note |
| `IndexStatus` | Compact factual health and recovery strip | Reusable domain | Status/live regions; all `IndexHealth` states |
| `IndexProgress` | Actual indexing job counters and error detail | Domain | Progress semantics; determinate/indeterminate/failed |
| `CloudBoundaryControl` | Exact destination, disclosure, per-request authorization | Domain | Explicit name; local/cloud/unconfigured/blocked |
| `SettingsView` | Four-section draft forms, validation, save/cancel | Domain | Dialog/sheet focus rules; clean/dirty/invalid/saving |

Common primitives: `Button`, `IconButton`, `TextField`, `TextArea`, `Select`, `Dialog`, `Sheet`, `Menu`, `Tooltip`, `InlineAlert`, `StatusDot`, `Skeleton`, and `VisuallyHidden`. Prefer native elements and small wrappers. Do not create a general plugin/component framework.

Existing Phase 2 hooks remain useful domain seams: `useWorkspaceChat`, `useWorkspaceEvidence`, `useWorkspaceHistory`, and `useWorkspaceIndex`. Phase 3B should split rendering ownership around these boundaries rather than introduce a global store solely for layout.

## U. Navigation/State Model

```text
AppLocation
  launcher
    settings?: open(section)
    openFlow?: selecting | prerequisites | indexing | failed

  workspace(workspaceId)
    mode: ask | find
    activeChatId
    history: collapsed | expanded | drawer
    evidence:
      closed
      open(tab: sources | files | context, selection?)
      drawer(tab, selection?)
    settings?: open(section)
    generation: idle | streaming | stopping
```

- Canonical `workspaceId` comes from the backend-authorized workspace record. Path is display and authorization data, never an alternative UI identity.
- Mode, panel selection, and draft are local UI state. Workspace sessions/context/provider selection continue through the Phase 2 persistence layers.
- Opening a source changes only `evidence` state. It must not mutate mode, chat, or Find results.
- Switching workspace disposes current workspace hooks, then initializes all domains with the next canonical ID. No domain may render cached data until that ID matches.
- Settings is application-level but model/index controls clearly state which workspace they affect.
- Destructive confirmations are nested modal states, not routes.

## V. Design Invariants

1. The active workspace name is always identifiable inside Workspace; the canonical ID owns all requests.
2. Ask and Find are always explicit, equally reachable modes; Atlas does not auto-route intent.
3. Evidence inspection never destroys conversation, Find results, draft, or scroll state.
4. Evidence shown for an answer is the evidence associated with that answer—not the latest global result set.
5. Manual context is visible at the composer whenever it can influence a request.
6. Workspace history, manual context, provider selection, and source paths never cross workspace boundaries.
7. The interface always states whether generation will be Local · Ollama or Cloud · OpenRouter before send.
8. Enabling cloud explains every category that may leave the machine; backend per-request authorization and full-payload inspection remain mandatory.
9. Healthy index state is quiet; index-required, incompatible, failed, and provider-unavailable states are persistent and actionable.
10. Models and index statistics never dominate the primary query surface.
11. Raw retrieval distance is never presented as confidence or relevance.
12. Progress, budgets, readiness, and freshness are displayed only when backed by real contracts.
13. Persistent failures are never toast-only.
14. The center query surface wins when window width is constrained.
15. Routine file/evidence inspection is non-modal.
16. No Phase 2-removed experimental feature reappears through navigation, settings, components, copy, or decoration.

## W. Phase 3B Implementation Plan

Each stage should land with the application usable; feature behavior is moved behind the new surface before the old surface is removed.

### 1. Contract and regression scaffold

- **Components:** none visually complete; test harness for AppShell/domain hooks.
- **Contracts:** confirm `EvidenceResult`, `IndexHealth`, structured `AppError`, workspace identity; specify `WorkspaceSummary` and file preview response changes.
- **Risks:** designing UI against unavailable freshness/readiness data.
- **Complete when:** contract tests cover serialization, source range, workspace ownership, and existing Phase 2 flows; unsupported UI claims are flagged.

### 2. Foundations, tokens, and primitives

- **Components:** common primitives, typography, surfaces, focus, semantic status styles.
- **Contracts:** none.
- **Risks:** broad CSS replacement breaking existing layout; inaccessible color pairing.
- **Complete when:** dark/light tokens, focus, reduced motion, controls, dialog/sheet, alert, and typography pass targeted visual/accessibility checks while legacy screens still work.

### 3. App shell and panel state

- **Components:** `AppShell`, panel state, responsive breakpoints.
- **Contracts:** authorized workspace restore unchanged.
- **Risks:** losing state across panel/breakpoint changes.
- **Complete when:** launcher/workspace switch, compact history rail, Evidence closed/open/drawer, and settings sheet work without losing active workspace/mode.

### 4. Launcher

- **Components:** `WorkspaceLauncher`, `WorkspaceRow`, initial index flow.
- **Contracts:** ideally `WorkspaceSummary` availability/live health and index preflight.
- **Risks:** conflating missing and unauthorized roots; making model setup dominant again.
- **Complete when:** empty, ready, unindexed, missing/unavailable, indexing, and failed states have persistent accurate actions; removal is clearly launcher-only.

### 5. Workspace header and status

- **Components:** `WorkspaceHeader`, `QueryModeSwitch`, `IndexStatus`, compact destination control.
- **Contracts:** existing index/provider settings; optional incompatibility reason.
- **Risks:** header control overload and status duplication.
- **Complete when:** workspace, Ask/Find, health problem, destination, Evidence, Settings, and Switch are clear at all supported widths; healthy metadata is de-emphasized.

### 6. Ask, conversation, and composer

- **Components:** `AskView`, `Composer`.
- **Contracts:** frontend turn lifecycle plus existing stream/error/cancel events.
- **Risks:** stale closures, session mutation during streaming, scroll jumps, IME submission.
- **Complete when:** empty/chat/generating/stopping/stopped/failed/no-source states work, drafts survive mode switch, evidence remains per answer, and error UI persists.

### 7. Find

- **Components:** `FindView`, result rows, Ask transition.
- **Contracts:** existing `EvidenceResult`.
- **Risks:** accidental confidence claims; results lost on preview or failed repeat query.
- **Complete when:** explicit query, ranked factual results, Pin, Ask about this, selection, blank/loading/no-results/failure, and keyboard behavior are tested.

### 8. Evidence, files, and source preview

- **Components:** `EvidencePane`, `CitationList`, `SourcePreview`, `FileBrowser`.
- **Contracts:** retain `totalLines`; optional preview capability; existing workspace-authorized reads.
- **Risks:** rendering large files, stale ranges, tree accessibility, center becoming too narrow.
- **Complete when:** citation/result/file opens non-modally, range highlighting is correct, multiple sources navigate, missing/stale/unsupported states recover, and pane/drawer transitions preserve state.

### 9. Context basket and Git context

- **Components:** `ContextBasket`, composer indicator.
- **Contracts:** existing session manual context; workspace setting for Git inclusion; optional assembly summary.
- **Risks:** implying unavailable files were sent, fake budget precision, migration changing current Git behavior.
- **Complete when:** per-chat persistence, pin from every source surface, remove/clear, unavailable-item handling, Git toggle/visibility, and workspace isolation tests pass.

### 10. History

- **Components:** `HistoryPanel` rail/drawer/list actions.
- **Contracts:** existing workspace-scoped history persistence/migration.
- **Risks:** mutating active session during generation and inaccessible row actions.
- **Complete when:** grouping, active state, new/open/rename/delete/export, empty/corrupt states, and reload/workspace isolation are verified.

### 11. Indexing and recovery

- **Components:** `IndexStatus`, `IndexProgress`, index prerequisite/recovery states.
- **Contracts:** current job status; optional freshness/incompatibility/preflight additions.
- **Risks:** invented progress, unsafe rebuild messaging, offering cancellation that does not exist.
- **Complete when:** every section K state supported by the backend has an accurate persistent treatment; initial index and failure retry work; no fake cancel/progress exists.

### 12. Settings, models, and cloud boundary

- **Components:** `SettingsView`, `CloudBoundaryControl`, disclosure sheet.
- **Contracts:** Rust credential boundary, provider readiness/errors, existing `allowCloud`; versioned workspace disclosure persistence.
- **Risks:** key leakage, ambiguous save scope, accidental cloud send, weakening backend authorization.
- **Complete when:** four groups, draft/save/cancel/dirty flow, credential replacement, exact cloud disclosure, per-request destination, full-payload blocked state, and local/cloud switching are tested.

### 13. Keyboard, accessibility, visual polish, and regression

- **Components:** all major components.
- **Contracts:** no new contract required.
- **Risks:** shortcut conflicts, focus loss across responsive drawers, light-mode neglect, regressions hidden by cosmetic work.
- **Complete when:** shortcut matrix, focus trapping/restoration, tree keyboard use, live regions, AA contrast, reduced motion, wide/laptop/minimum layouts, frontend tests/build, Rust suite, Tauri smoke, and retained end-to-end workflow pass.

## X. Open Questions

These are the only unresolved items that require an implementation-scope decision; they do not change the product hierarchy above.

1. **Launcher/index summary contract:** will Phase 3B add a canonical `WorkspaceSummary` plus preflight/freshness fields, or must the launcher deliberately limit itself to persisted last-known facts and current `IndexHealth` after authorization?
2. **Context assembly receipt:** should Phase 3B add a backend response/event describing which evidence, manual files, history, and Git context were included or truncated, or defer exact assembly visibility and show only file count?
3. **No-relevant-evidence semantics:** will retrieval define a reliable threshold/outcome distinct from zero returned rows? Until it does, the UI must say “No workspace sources were returned” and must not claim no relevant evidence exists.
