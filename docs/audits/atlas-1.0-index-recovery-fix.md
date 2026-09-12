# Atlas 1.0 Index-Recovery Fix

**Date:** 2026-09-12
**Target:** 1.0.0, Windows x64, unsigned NSIS only
**Status:** automated fix and package build complete; post-fix rendered native QA remains required

## Executive summary

A genuine native clean-profile indexing attempt selected `<repository-root>` through Atlas's folder picker and used `nomic-embed-text:latest`. It failed at `0 files / 0 chunks` with a Lance `Not found` error for a fragment referenced by `%USERPROFILE%\.atlas\lancedb\atlas_v2_1536.lance`.

This was a release blocker. Atlas now detects a missing or structurally damaged generated Lance table before it can be reported healthy or used for retrieval, rebuilds only the affected dimension table during indexing, and invalidates manifests that could claim vectors from that table. It never deletes source workspace files, the whole `.atlas` directory, authorization state, or an unrelated dimension table. The post-fix NSIS package was built and installed, but the available automation service exposes no native Atlas window, so the required rendered recovery workflow is still unobserved. The recommendation is therefore **NO-GO pending that final native observation**.

## Preserved investigation state

- Baseline HEAD: `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a`.
- The pre-existing dirty working tree was recorded and preserved.
- Before changing active state, a cold copy of the damaged `atlas_v2_1536.lance` table, manifests, and `authorized-workspaces.json` was saved at `%LOCALAPPDATA%\Temp\atlas-index-recovery-investigation-20260912`.
- The owner authorization registry contained canonical Atlas and Janbros roots. It was not edited. No source workspace content was changed.

## Exact failure and root cause

The indexer surfaced `Delete error: lance error: LanceError(IO): Execution error: Not found` for a missing fragment below `~/.atlas/lancedb/atlas_v2_1536.lance/data/`. The table metadata and transaction history remained, but the referenced `data` fragment did not.

The replacement protocol correctly stages new embeddings and then commits a manifest with `cleanup_pending: true` before deleting obsolete rows. However, the former cleanup operation opened **every** `atlas_v2_*` table. A broken `atlas_v2_1536` table consequently failed a cleanup for any workspace, even if that workspace was using another dimension. On retry, the committed `cleanup_pending` entry was retried first, so the same damaged-table delete failed again. This is a generated-index integrity failure, not a source-file failure and not an Ollama embedding failure.

## Why an apparently clean profile reached old vectors

Atlas has intentionally separate state layers:

| Layer | Location / scope |
| --- | --- |
| WebView launcher, settings, history, pins | application profile under `%LOCALAPPDATA%` |
| Rust authorization registry | `~/.atlas/authorized-workspaces.json` |
| Per-workspace manifests | `~/.atlas/manifests/` |
| Generated vector tables | `~/.atlas/lancedb/` |

A clean frontend/WebView profile does not clear the persistent backend retrieval store. That behavior preserves indexes across UI-profile changes, but it means a first-looking UI can encounter stale generated retrieval state. The fix makes that separation explicit in product behavior: a manifest cannot claim a healthy index unless its owned vector table is readable, and recovery occurs through the normal index action.

## Table ownership and recovery behavior

Lance tables are named by vector dimension (`atlas_v2_1536`, `atlas_v2_768`, etc.), not workspace ID. Workspaces using the same embedding dimension can share a table, segregated by canonical `workspaceId` rows. The observed 1536 table is therefore shared-by-dimension rather than safely attributable to only Atlas.

The repair deliberately does the following:

1. Performs a bounded read probe of the exact dimension table before the unchanged-file fast path or a `ready` health result.
2. Recovers only errors characteristic of a missing/corrupt Lance generated dataset. Permission, disk-space, and unrelated I/O errors remain actionable failures; they are not silently dropped.
3. Drops only the damaged generated dimension table through LanceDB, then invalidates manifests with that dimension. Legacy manifests without recorded dimension ownership are conservatively invalidated because they cannot truthfully claim rows after shared-table recovery.
4. Clears staged chunk IDs and `cleanup_pending` on affected manifests and marks them incompatible, requiring normal reindexing. Unaffected dimensions and their manifests stay intact.
5. Rebuilds through the existing authorized workspace crawler and embedding flow. Workspace sources are never modified.

Pipeline version 6 stores `vector_dimension` on each manifest entry. This is a one-time integrity migration from v5: an old manifest is incompatible rather than being treated as healthy without table ownership metadata.

## User-facing behavior

The primary launcher/health message is: `Atlas detected a damaged local index and needs to rebuild it.` The original Lance error is retained in application logs for diagnosis, but the user is not shown a raw Rust stack trace or a private local path as the primary UX. Retrying indexing runs the actual bounded recovery/rebuild path; it does not pretend a failed table is healthy.

## Regression coverage

New focused coverage includes:

- deleting a real fragment from a disposable Lance table, detecting it, dropping only that generated table, recreating it, and verifying the source fixture is untouched;
- preserving a different-dimension table and another workspace's rows while the damaged table is recovered;
- invalidating affected and legacy manifests while retaining a current manifest for a different dimension;
- treating `cleanup_pending` as requiring an index pass;
- refusing to expose raw Lance fragment paths as primary index UI text.

The full Rust suite is now **47/47** passing. The two vector-store tests use unique temporary directories and do not touch the owner's Atlas state.

## Validation results

| Gate | Result |
| --- | --- |
| Desktop tests | PASS — 36/36 |
| Desktop lint / TypeScript / Vite build | PASS |
| Rust fmt / check / strict Clippy | PASS |
| Rust all-target tests | PASS — 47/47; retrieval integration test remains intentionally ignored outside its gate |
| Retrieval gate | PASS — Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5 |
| Turbo / version / notices / diff check | PASS |
| New NSIS package | PASS — built x64 NSIS only and installed silently with exit 0 |

## Candidate and native follow-up

The rebuilt candidate is `release-candidates/Atlas_1.0.0_x64-setup-index-recovery-fix.exe`:

- SHA-256: `85ECC37CE577BF375B26BE0961EE3A9032FFDC82FCC2390A211F3D2B7C4D7371`
- Version: `1.0.0`
- Signing: `NotSigned` by the accepted Atlas 1.0 owner policy

The exact native follow-up remains: select Atlas via the genuine picker, observe the repair/index-required state, rebuild with `nomic-embed-text:latest`, record the visible file/chunk counts, then verify authorization Ask, indexing follow-up, Kubernetes no-evidence rejection, pinned `workspace.rs`, Evidence, and a normal relaunch. No native window was available to the connected desktop-control provider in this session, so none of those rendered outcomes is claimed here.

## Files changed in this task

- `apps/desktop/src-tauri/src/vectorstore.rs`
- `apps/desktop/src-tauri/src/manifest.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/components/LandingScreen.tsx`
- this report and the referenced release-report/checklist addenda

## Subsequent Native Recovery Confirmation and v7 Note

Subsequent native validation confirmed this recovery repair: the Atlas workspace
reached `ready` at **116 files / 1,221 chunks**, and the missing Lance fragment
did not recur. The LanceDB/index-recovery blocker is closed.

The later v7 pipeline change is deliberately separate: it excludes the internal
synthetic retrieval evaluation corpus from future normal indexes. It requires a
normal reindex to remove stale fixture rows, but does not change table ownership,
recovery semantics, source workspaces, or authorization state.

All prior Phase 1–4, audit, cleanup, and user work remains unmodified except where these files already contained earlier release work. No commit, push, tag, upload, release, or publication occurred.
