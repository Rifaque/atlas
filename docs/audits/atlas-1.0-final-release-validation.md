# Atlas 1.0 Final Release Validation

**Target:** 1.0.0, Windows x64, NSIS only
**Current decision:** NO-GO pending post-fix installed-runtime observation

## A. Executive Summary

The original clean-profile NSIS run successfully reached the native picker, workspace authorization, indexing, Ask, Find, and Evidence, but exposed a grounding regression. That candidate must not be released. The remediation and automated gates are complete; the rebuilt candidate requires the same real-runtime observation.

## B. Candidate Artifact

The retained pre-fix candidate is `release-candidates/Atlas_1.0.0_x64-setup.exe`, SHA-256 `B294FDC762663B3221E1EEDA8F098677BB885F44CC42E9EB36D315766F256072`, version 1.0.0, unsigned. It is evidence only, not the post-fix release candidate.

The post-fix candidate is `release-candidates/Atlas_1.0.0_x64-setup-grounding-fix.exe`, SHA-256 `BAB02E4A00B5BDEE7AE4259D3F9CCCBB81AEEE69D77E079C8099F6264032B2EE`, version 1.0.0, unsigned. Its silent NSIS install completed with exit code 0 and the installed executable launched from `%LOCALAPPDATA%\Atlas\app.exe`.

## C. Clean Profile Setup

The owner's Atlas profile is isolated using the previously inspected application-data locations; no workspace authorization is injected. The post-fix test will use the installed release candidate and the real local Atlas workspace.

## D. Native Folder Picker

The earlier candidate's picker was manually observed. Re-observation is required after the post-fix installer is installed.

## E. Workspace Authorization

The earlier native workflow authorized the canonical workspace through the Rust boundary. No internal persistence edit is used in post-fix QA.

## F. First Index

Pipeline version 5 intentionally shows the existing v4 index as incompatible and requires a normal rebuild. This removes archival-audit evidence from the new runtime index.

## G. First Ask / Follow-up

Post-fix validation must observe the authorization query and indexing follow-up against the rebuilt index, then verify grounded response and follow-up behavior.

## H. Find

Post-fix validation must observe exact, conceptual, and unrelated Find behavior; the unrelated Kubernetes request must present no arbitrary evidence.

## I. Evidence

Evidence must remain opened from an Ask/Find result with correct source range and preserved conversation state.

## J. Context

Pin the actual authorization source and ask for its guarantees. The answer must primarily discuss canonicalization, inside-root enforcement, traversal/outside-root rejection, and applicable symlink handling.

## K. History

Perform the existing fresh-profile sanity check: session appears, New Chat works, switching is workspace-scoped.

## L. Restart Persistence

Close/relaunch the installed post-fix app and confirm workspace authorization, healthy v5 index, and chat history persist without an unexpected complete reindex.

## M. Owner Profile Restoration

The owner profile must be restored exactly after the isolated QA session. No user data is deleted.

## N. Automated Regression Gates

Desktop: 36/36 tests passed; ESLint, TypeScript, Vite production build passed. Rust: 43/43 tests passed; fmt, check, and warnings-denied Clippy passed. Retrieval: Hybrid Hit@5 1.0, nDCG@5 0.9959934, negative rejection 5/5. Root Turbo build, version consistency, notices, and `git diff --check` passed.

## O. New Issues Found

The Kubernetes/no-evidence, stale-audit, and pin-priority defects are documented in `atlas-1.0-grounding-regression-fix.md`. No additional automated functional/security defect was found.

## P. Remaining SHOULD FIX

Trusted Windows signing if distribution justifies it; broader real-repository retrieval calibration.

## Q. Remaining POST-1.0

Trusted Windows signing/SmartScreen reputation, Linux validation, macOS support/notarization, and disabled-updater infrastructure.

## R. Final Release Recommendation

**NO-GO pending post-fix installed-runtime validation.** Unsigned Windows distribution is an accepted condition, not the cause of this decision.

## S. Release Conditions

Windows x64 only; NSIS only; unsigned with SmartScreen/Unknown Publisher expected; publish SHA-256; updater disabled; Linux unverified; macOS unsupported.

## T. Exact Next Release Steps

After a passing post-fix manual run: review the working tree, commit intended 1.0 work, verify final SHA-256, create/push `v1.0.0`, verify CI, create/publish a GitHub Release, attach the NSIS installer and checksum, then run a published-installer smoke test. None of these actions has been performed.

## U. 2026-09-12 Agent-Run Runtime Evidence

The installed app and Ollama were live. The isolated release profile had
completed its required v5 rebuild: **116 files / 1,202 chunks**. A read-only
probe used the production LanceDB retrieval path and was then removed. It found
current authorization code among the five sources, current-only indexing
sources, and Kubernetes `none` with zero sources. No `docs/audits/` row was
returned.

No connected computer-control provider could bind to the native Atlas window.
Consequently, actual rendered answer text, Evidence, pin interaction, and normal
restart persistence were not observed. Recommendation remains **NO-GO pending
UI evidence**, while unsigned Windows remains an accepted condition. The owner
profile is restored and the QA profile is retained at
`%LOCALAPPDATA%\Temp\atlas-postfix-grounding-qa-20260912`.

## V. 2026-09-12 Lance Index-Recovery Blocker

A later genuine clean-profile native indexing attempt exposed a separate
release-blocking data-integrity defect. The legitimate picker selected
`<repository-root>` with
`nomic-embed-text:latest`, but the UI showed **Indexing failed**, `0 files · 0
chunks`, and a Lance `Not found` error while deleting from the persistent,
dimension-named `~/.atlas/lancedb/atlas_v2_1536.lance` table. Thus a clean
frontend profile was not a clean generated retrieval store.

The repair is documented in
[`atlas-1.0-index-recovery-fix.md`](atlas-1.0-index-recovery-fix.md). It adds
manifest-owned vector dimensions (pipeline v6), active table-read health checks,
targeted generated-table recovery, conservative manifest invalidation, and a
concise recovery message. It does not delete source workspaces, the whole
`.atlas` directory, authorization state, or unrelated dimension tables.

Automated validation after the repair passed: desktop **36/36**, Rust **47/47**,
strict Clippy, frontend build, Turbo/version/notices/diff gates, and retrieval
Hybrid Hit@5 `1.0`, nDCG@5 `0.9959934`, negative rejection `5/5`. The rebuilt,
installed unsigned x64 NSIS candidate is
`release-candidates/Atlas_1.0.0_x64-setup-index-recovery-fix.exe`, SHA-256
`85ECC37CE577BF375B26BE0961EE3A9032FFDC82FCC2390A211F3D2B7C4D7371`.

The connected desktop-control provider exposes no native Atlas window, so the
post-fix rendered picker/recovery/index/Ask/Evidence/pin/relaunch sequence has
not been observed and is **not** being claimed. The release decision remains
**NO-GO** for that functional evidence gap. Unsigned Windows distribution
remains an accepted owner condition, not a blocker.

## W. Pinned-Context Final Validation Gate (2026-09-12)

Native post-recovery validation subsequently reported a healthy Atlas index at
**116 files / 1,221 chunks**, a current indexing follow-up without retired
Graph/Insights, and the Kubernetes explicit insufficient-evidence response with
zero sources. Those prior blockers are closed.

The same run found that a source-directed `workspace.rs` pin could be overridden
by a retrieved `commands.rs` test and that
`apps/desktop/src-tauri/fixtures/retrieval/evaluation.json` could appear as
production evidence. The v7 fix is recorded in
[`atlas-1.0-pinned-context-final-fix.md`](atlas-1.0-pinned-context-final-fix.md).
It needs a fresh installed x64 NSIS runtime observation (including normal v7
reindex) before the recommendation can change from **NO-GO**. Signing remains an
accepted condition, not a blocker.

### Rebuilt v7 candidate status

The v7 pinned-context repair was packaged as the unsigned x64 NSIS-only
candidate `release-candidates/Atlas_1.0.0_x64-setup-pinned-context-fix.exe`
(SHA-256 `F398D5E3075EC27333D85805E70D5AB16DA0A6487956E831E26C50B3D6FB14B8`).
Its NSIS silent install exited 0 and `%LOCALAPPDATA%\\Atlas\\app.exe` reports
1.0.0 / `NotSigned`. Desktop **37/37**, Rust **52/52**, strict Clippy,
Vite/Turbo, version/notices/diff, and retrieval (Hit@5 1.0, nDCG@5 0.9959934,
negative rejection 5/5) pass. The provider exposed no native Atlas surface, so
the required rendered v7 reindex/pin/Evidence/restart checks remain unobserved.

## X. Source-Grounded Answer Discipline Gate (2026-09-12)

The subsequent native release check found a final generation-only issue: correct
retrieval evidence could still be summarized with invented implementation
responsibilities, or a design-spec symbol could be presented as runtime code.
The repair classifies prompt evidence by deterministic path provenance and makes
implementation code primary in the bounded generation context for
implementation-worded questions. It preserves the v7 pin/fixture and
no-evidence/recovery behavior without changing retrieval rankings.

The new unsigned x64 NSIS-only candidate is
`release-candidates/Atlas_1.0.0_x64-setup-source-grounding-final.exe`, SHA-256
`07213A8FCA0F9E7E6812126F53EA674E5466BBB28AD4BDBB1134ABAA0CA08BB8`.
Automated validation passes: desktop **37/37**, Rust **56/56**, strict Clippy,
Vite/Turbo, version/notices/diff, and retrieval Hit@5 `1.0`, nDCG@5
`0.9959934`, negative rejection `5/5`. See
[`atlas-1.0-source-grounding-final-fix.md`](atlas-1.0-source-grounding-final-fix.md).

The connected desktop-control provider still exposes no native Atlas surface, so
this candidate has not been installed over the running candidate and no rendered
authorization/indexing/Kubernetes/pinned/Evidence/restart result is claimed.
The recommendation remains **NO-GO** pending that final native validation;
unsigned distribution remains accepted, not a blocker.

## Y. Fabricated Source-Code Final Closure (2026-09-12)

The final native observation exposed a narrower generation issue: a correctly
retrieved `commands.rs` answer showed a fenced Rust block containing the invented
`state.active_workspace_id` field. Atlas now validates non-example fenced code
against only the exact evidence content supplied to the generating request, after
normalizing only line endings and trailing whitespace. Invalid fences are removed
before any model text reaches Markdown rendering; surrounding prose and the already
emitted citations remain intact. No workspace-wide post-response search occurs.

The deterministic regression fixture reproduces the original
`start_indexing_internal`/`active_workspace_id` failure and passes. Exact automatic
and pinned excerpts remain valid. Desktop **37/37**, Rust **66/66**, fmt/check/
strict Clippy, Vite/Turbo, version/notices/diff, and retrieval Hit@5 `1.0`, nDCG@5
`0.9959934`, negative rejection `5/5` pass.

The final unsigned x64 NSIS-only candidate is
`release-candidates/Atlas_1.0.0_x64-setup-final.exe`, SHA-256
`FD73D54CEF9EE057B1F6C5E05D48E2E5C569A29B3963729C3BC10D008C584D3C`.
This deterministic final-output guard closes the remaining fabricated-code blocker
without requiring another normal manual prompt-by-prompt QA cycle. **Atlas 1.0.0 is
release-ready for unsigned Windows x64 NSIS distribution.**

Final recommendation: **GO**. Functional blockers: **0**. Remaining SHOULD FIX:
**2** (trusted signing if adoption warrants it; broader real-repository retrieval
calibration). Remaining POST-1.0: **4** (SmartScreen/trusted signing, Linux
validation, macOS support/notarization, updater infrastructure).

## Website Deployment Architecture Addendum (2026-09-13)

The historical GitHub Actions Vercel-CLI deployment attempt is superseded. GitHub
Actions now verifies the standalone Next.js site only. Production deployment is
performed directly by Vercel's Git integration for `Rifaque/atlas`: project
`atlas-desktop`, branch `main`, root directory `website`, `npm ci`, then
`npm run build`. `website/vercel.json` pins the Next.js framework preset for the
direct deployment. No Vercel credential is required by the Actions workflow.
