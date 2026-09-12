# Atlas 1.0 Fabricated-Code Final Fix

**Date:** 2026-09-12
**Target:** 1.0.0 / Windows x64 / NSIS only
**Status:** release closure complete

## Observed Failure and Root Cause

The installed pre-fix candidate retrieved the current `commands.rs` implementation
for the indexing follow-up, including `start_indexing_internal`, but the generation
model emitted a fenced Rust block containing:

```rust
state.active_workspace_id = Some(folder_path.clone());
```

That line is not in the supplied evidence and `AppState` has no such field. The
prior source-grounding prompt improved source authority but relied on model
compliance; streamed model chunks reached Markdown rendering without a deterministic
verbatim-source check.

## Deterministic Guardrail

Atlas now buffers a generation response before emitting it to the UI. For a normal
implementation/source explanation, each fenced code block is retained only if its
code is a non-empty, contiguous substring of one evidence item that was actually
supplied to that generation call. The comparison normalizes only CRLF/LF differences
and trailing whitespace. It never searches arbitrary workspace files.

An unverified complete or incomplete fenced block is removed while surrounding prose,
citations, and evidence remain intact. The model prompt additionally says not to
reconstruct workspace source code and to prefer prose plus citations. Explicitly
requested example/proposal/patch code remains permitted only for narrow deterministic
query phrases and must be presented as an example, not as an existing source excerpt.

## Regression Coverage

The production answer-assembly contract now tests:

- the exact `active_workspace_id` fabricated-line failure is removed while adjacent
  indexing prose remains;
- exact automatic and pinned source excerpts are retained;
- a mixed real-plus-invented source block is removed as a whole;
- CRLF/LF and trailing-whitespace-only differences remain valid;
- a block cannot validate against a workspace source that was not supplied;
- the selected citations/evidence contract is unchanged by sanitization;
- ordinary requests such as “write a summary” cannot bypass validation; and
- explicitly requested generated examples remain allowed.

Existing source-authority, pinned-context, fixture-exclusion, no-evidence,
Kubernetes-negative, and Lance-recovery tests remain green. No retrieval scoring,
index pipeline, source storage, pin architecture, or model call was changed.

## Validation Results

| Gate | Result |
| --- | --- |
| Fabricated `active_workspace_id` regression | PASS — fenced block removed deterministically |
| Valid exact automatic/pinned source block | PASS — retained |
| Desktop tests | PASS — 37/37 |
| Desktop lint / TypeScript / Vite build | PASS |
| Rust fmt / check / strict Clippy | PASS |
| Rust all-target tests | PASS — 66/66 (retrieval integration remains intentionally ignored outside its gate) |
| Retrieval gate | PASS — Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5 |
| Turbo / version / notices / diff check | PASS |

## Final Candidate

- Path: `release-candidates/Atlas_1.0.0_x64-setup-final.exe`
- SHA-256: `FD73D54CEF9EE057B1F6C5E05D48E2E5C569A29B3963729C3BC10D008C584D3C`
- Version: `1.0.0`
- Format: x64 NSIS only; no MSI was built
- Signing: `NotSigned`, accepted by the owner for Atlas 1.0. SmartScreen/Unknown
  Publisher warnings remain an honest release condition; the published checksum is
  not Authenticode.

## Release Recommendation

**GO.** The guard is post-generation and deterministic, so a model cannot render a
new fabricated workspace-source fence even when prompt compliance fails. The
requested final contract test is stronger and more direct than another stochastic
manual prompt cycle for this narrow defect.

There are **0 functional release blockers**. Remaining items are two SHOULD FIX
items (trusted Windows signing if adoption warrants it; broader real-repository
retrieval calibration) and four POST-1.0 items (SmartScreen reputation/trusted
signing, Linux validation, macOS support/notarization, and updater infrastructure).

No commit, push, tag, release, upload, publication, or updater enablement occurred.
All owner profile data, source workspaces, retained candidates, and pre-existing
working-tree changes were preserved.
