# Atlas 1.0 Pinned-Context Final Fix

**Date:** 2026-09-12
**Target:** 1.0.0 / Windows x64 NSIS
**Status:** implementation and automated gates complete; rebuilt-candidate native observation pending

## A. Executive Summary

Native validation closed the Lance recovery and unrelated-query blockers: the
Atlas workspace reached `ready` at 116 files / 1,221 chunks, and Kubernetes
returned the explicit insufficient-workspace-evidence response with zero
sources. A remaining narrow defect allowed automatic retrieval to override a
correctly pinned file in a source-directed request, and allowed the synthetic
retrieval evaluation corpus to enter normal workspace evidence.

The repair keeps the retrieval design intact. It makes explicitly selected
source context primary only for deterministic source-directed wording, labels
and returns pinned evidence truthfully, and excludes only Atlas's internal
retrieval-evaluation fixture from normal workspace crawling. The pipeline is v7
so existing indexes rebuild without already-indexed fixture rows.

## B. Pin Pipeline and Root Cause

The frontend stores a workspace-scoped list of pinned paths in each chat
session. The backend re-authorizes every pin with `authorized_file`,
canonicalizes and de-duplicates it, then reads it for context assembly. The old
assembly gave the pin an anonymous 2,000-character leading excerpt while also
supplying automatic results and returning only those automatic results as
citations. `workspace.rs` is 3,749 characters / 101 lines, so it was truncated;
a retrieved `commands.rs` regression-test chunk could then outweigh it. The
prompt only said to prefer the pin, allowing invented `Workspace` APIs absent
from the free-function implementation.

## C. Pinned-Context Fix

`PinnedContextMode` distinguishes two deterministic cases:

- **SourceAuthoritative:** wording such as “Using the pinned source” or
  “Summarize the pinned file” supplies only `[P1] PINNED / USER-SELECTED
  SOURCE: <workspace-relative path>` to generation. The prompt forbids
  inferring types, methods, APIs, guarantees, or behavior absent from it.
- **Supporting:** interaction questions keep bounded hybrid retrieval. The pin
  remains first and explicitly identified; automatic evidence stays secondary.

A single pin may use the existing 6,000-character pinned budget (enough for the
current `workspace.rs`); multiple pins remain per-file bounded. Pinned evidence
has canonical identity, exact supplied content/range, and source type
`pinned_workspace_file`; automatic evidence uses `workspace_file`. The UI shows
`Pinned` or `Retrieved`, so considered evidence matches generation context
without implying claim-level attribution.

## D. Fixture Contamination

`apps/desktop/src-tauri/fixtures/retrieval/evaluation.json` is a synthetic
retrieval corpus, not product evidence. The crawler excludes precisely that
workspace-relative path. Ordinary source code, tests, current docs, and other
fixture locations are retained. Pipeline v7 is necessary because existing
indexes can already hold its rows; normal manifest/vector replacement removes
them. This is not a Lance schema or recovery migration.

## E. Regression Coverage

Tests cover canonical pin resolution and outside-root rejection, content/range
preservation, one-pin budgeting, source-directed priority/automatic-context
omission, supporting-mode behavior, workspace/session isolation, evidence
typing in the UI, exact synthetic-fixture exclusion, ordinary-source retention,
and existing authorization/Kubernetes retrieval gates.

## F. Automated Results

| Gate | Result |
| --- | --- |
| Desktop tests | PASS — 37/37 |
| Desktop lint / TypeScript / Vite build | PASS |
| Rust fmt / check / strict Clippy | PASS |
| Rust all-target tests | PASS — 52/52 |
| Retrieval evaluation | PASS — Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5 |
| Turbo / version / notices / diff check | PASS |

## G. Required Native Candidate Validation

The fresh unsigned x64 NSIS candidate is
`release-candidates/Atlas_1.0.0_x64-setup-pinned-context-fix.exe`:

- SHA-256: `F398D5E3075EC27333D85805E70D5AB16DA0A6487956E831E26C50B3D6FB14B8`
- Version: `1.0.0`
- Signing: `NotSigned`, as accepted by the Atlas 1.0 owner policy
- Install: NSIS silent installer exit code 0; installed
  `%LOCALAPPDATA%\\Atlas\\app.exe` reports version 1.0.0

The source change requires a normal v7 index rebuild. The installed candidate
must show authorization Ask without
`evaluation.json`; current indexing follow-up; Kubernetes zero-evidence;
source-directed `workspace.rs` without invented APIs; correct Evidence
path/range; and normal restart persistence. These rendered results are not
claimed until observed. The available computer-control provider exposed no
native Atlas app/window (only browser surfaces), so this session could not
perform that legitimate UI flow or use a native picker.

## H. Release Recommendation

**NO-GO pending rebuilt-candidate native pinned-context validation.** This is
one remaining functional runtime-evidence condition. Unsigned Windows x64 NSIS,
SmartScreen / Unknown Publisher behavior, and the disabled updater remain
accepted Atlas 1.0 conditions, not blockers.

## I. Files Changed in This Fix

- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/crawler.rs`
- `apps/desktop/src-tauri/src/manifest.rs`
- `apps/desktop/src-tauri/src/retrieval.rs`
- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/lib/chats.ts`
- `apps/desktop/src/components/EvidencePane.tsx`
- `apps/desktop/src/components/interaction.test.tsx`
- release-report/checklist addenda and this report

All pre-existing source, documents, reports, owner profile data, and workspace
files were preserved. No commit, push, tag, release, upload, publication, or
updater enablement occurred.
