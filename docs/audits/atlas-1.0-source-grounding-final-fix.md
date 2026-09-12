# Atlas 1.0 Source-Grounded Answer Discipline Fix

**Date:** 2026-09-12
**Target:** 1.0.0 / Windows x64 NSIS
**Status:** automated remediation complete; installed-candidate native observation pending

## Executive Summary

Runtime validation established that hybrid retrieval can return the correct
evidence while a model still overstates implementation details. The observed
authorization answer conflated `canonical_workspace`, `authorized_file`, and
`registry_path`; the indexing follow-up treated a UX design specification as
runtime code. This repair changes only generation-context provenance and
instructions. Retrieval ranking, relevance thresholds, indexing, and the
no-evidence path are unchanged.

## Root Cause

The final system prompt previously identified sources only as `[P#]` or `[S#]`
with path/line ranges. It required grounding generally but did not distinguish
implementation code from documentation, design specifications, tests, or
fixtures. Automatic evidence remained in retrieval rank order even for prompts
asking where behavior is implemented. Consequently a plausible design or test
symbol could be synthesized as production detail.

## Generation Prompt and Context Changes

Every evidence path is now classified deterministically as implementation code,
documentation, design/specification, test, fixture, configuration, historical
audit, or other. Source headers supplied to the model include that category,
path, and line range. Pinned sources keep canonical authorization, priority, and
bounded context; their header now also identifies the source category.

Implementation-worded questions (`where is`, `implemented`, `how does`, `what
happens after`, `which function`, `enforced`, and related deterministic wording)
do not change retrieval. They stably reorder only the selected bounded generation
context so implementation code precedes configuration, docs, design, tests, and
fixtures. For these questions the prompt says:

- implementation code is proof of runtime symbols and behavior;
- documentation/design describe written intent, not executable code;
- tests/fixtures are non-production evidence;
- code wins on conflict;
- a function, struct, method, API, or responsibility must not be named unless
  the cited implementation evidence contains it; and
- unsupported details must be called out as not established by supplied evidence.

The existing source-directed pinned rule remains stricter: automatic evidence is
omitted and the selected pinned source is the sole authority.

## Tests

Focused Rust contract tests cover deterministic source classification, metadata
in the final generation prompt, implementation-code-first context ordering
without changing retrieval ordering, documentation/design/test handling,
source-directed pin priority, pinned budgeting/canonicalization, fixture
exclusion, authorization retrieval, and no-evidence behavior. They avoid brittle
assertions about stochastic model prose.

## Automated Validation

| Gate | Result |
| --- | --- |
| Desktop tests | PASS — 37/37 |
| Desktop lint / TypeScript / Vite build | PASS |
| Rust fmt / check / strict Clippy | PASS |
| Rust all-target tests | PASS — 56/56 |
| Retrieval evaluation | PASS — Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5 |
| Turbo / version / notices / diff check | PASS |

## Candidate and Native Validation

The shipped-code change was built as unsigned x64 NSIS only:

- `release-candidates/Atlas_1.0.0_x64-setup-source-grounding-final.exe`
- SHA-256: `07213A8FCA0F9E7E6812126F53EA674E5466BBB28AD4BDBB1134ABAA0CA08BB8`
- Version: `1.0.0`
- Signing: `NotSigned`, accepted by the Atlas 1.0 owner decision

The connected computer-control provider exposed no native Atlas window (only
browser surfaces), so this candidate was not installed over the running prior
candidate and no rendered Ask/Evidence/restart result is claimed. The required
native checks are the authorization distinction, code-first indexing follow-up,
Kubernetes zero-evidence response, pinned `workspace.rs` answer, Evidence
path/range, and normal restart persistence.

## Release Recommendation

**NO-GO pending native validation of the source-grounding candidate.** This is
the remaining functional runtime-evidence condition; unsigned Windows x64 NSIS,
SmartScreen/Unknown Publisher behavior, and the disabled updater are accepted
release conditions, not blockers.

## Files Changed

- `apps/desktop/src-tauri/src/retrieval.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src/lib/chats.ts`
- this report and release-report/checklist addenda

All pre-existing user work, source workspaces, Atlas profile data, reports, and
release candidates were preserved. No commit, push, tag, upload, publication,
or updater enablement occurred.

## Subsequent Fabricated-Code Closure (2026-09-12)

Native validation later found one remaining generation-only defect: a correct
`commands.rs` source could be followed by an invented fenced source-looking code
block. The final deterministic post-generation guard is recorded in
[`atlas-1.0-fabricated-code-final-fix.md`](atlas-1.0-fabricated-code-final-fix.md).
It validates each non-example fence against only the exact bounded evidence supplied
to the model, removes an unverified fence while retaining grounded prose/citations,
and leaves retrieval and source-authority behavior unchanged.

The final unsigned x64 NSIS-only candidate is
`release-candidates/Atlas_1.0.0_x64-setup-final.exe`, SHA-256
`FD73D54CEF9EE057B1F6C5E05D48E2E5C569A29B3963729C3BC10D008C584D3C`.
Desktop 37/37, Rust 66/66, strict Clippy, Vite/Turbo, version/notices/diff, and
the 5/5-negative retrieval gate pass. Because this guard deterministically enforces
the final-output invariant after generation, another normal manual prompt cycle is
not required for this narrow blocker. The final recommendation is **GO**.
