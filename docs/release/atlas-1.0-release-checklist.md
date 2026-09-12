# Atlas 1.0 Release Checklist

Target: `v1.0.0`, Windows x64, NSIS only. This checklist is operational; no
commit, tag, push, workflow run, or publication was performed during preparation.

## Pre-release

- [ ] Review the dirty working tree and commit only intended Atlas 1.0 files.
- [ ] Run `pnpm install --frozen-lockfile` and `pnpm version:check -- --expected 1.0.0`.
- [ ] Run `pnpm notices:generate`, review `THIRD_PARTY_NOTICES.md`, then run `pnpm notices:check`.
- [ ] Run desktop and website tests, lint, typecheck/build, Rust fmt/check/Clippy/tests, Turbo build, and `git diff --check`.
- [ ] With Ollama and `nomic-embed-text:latest` available, run `pnpm retrieval:eval`.
- [ ] Confirm README, BUILD, changelog, privacy language, platform claims, LICENSE, and notices are current.
- [ ] Confirm the updater remains disabled.

## Production signing — required blocker

- [ ] Reconsider trusted Windows Authenticode signing only if Atlas adoption justifies the cost; never commit a PFX/private key. This is not an Atlas 1.0 release gate.

## Windows package

- [ ] Build the release candidate through the reviewed release workflow, or locally with `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis`.
- [ ] Verify the NSIS candidate version and SHA-256. Atlas 1.0 is intentionally `NotSigned`; publish the checksum and disclose SmartScreen/Unknown Publisher behavior.
- [ ] Verify installer product/version/publisher metadata and SHA-256; keep the GitHub Release as a draft.
- [ ] Confirm `LICENSE.txt` and `THIRD_PARTY_NOTICES.md` are installed and the notices hash matches the reviewed source artifact.
- [ ] On a clean Windows profile, exercise the native picker, workspace authorization, first index, Ask, Find, Evidence, restart, and uninstall from the signed candidate.
- [ ] Confirm reinstall preserves intended profile/index/history data and never touches source-workspace files.
- [ ] Do not publish the MSI for 1.0.0; its all-users install was not viable in non-elevated lifecycle QA.

## Other platforms

- [ ] Do not publish Linux artifacts for 1.0.0; Linux is configured but lacks native packaging/runtime QA.
- [ ] Do not publish macOS artifacts for 1.0.0; packaging, signing, notarization, CI, and native QA are not configured.

## Release

- [ ] Commit reviewed release changes only after the two remaining blockers are closed.
- [ ] Create annotated tag `v1.0.0` and push it only after approval.
- [ ] Verify all GitHub Actions jobs and inspect the draft release artifacts.
- [ ] Recheck filenames, hashes, signatures, notices, changelog, and supported-platform language.
- [ ] Publish only when the release-readiness report can be changed from NO-GO with zero blockers.

## Post-release

- [ ] Download the published NSIS installer and independently verify hash/signature/timestamp.
- [ ] Install on a clean Windows profile; launch, open, index, Ask, Find, inspect Evidence, pin Context, and restart.
- [ ] Verify download links, displayed version, README, website metadata, and installed notices.
- [ ] Record failures and halt distribution; do not enable or use the disabled updater as a fallback.

## Subsequent owner decision on Windows signing (2026-09-07)

This decision supersedes the earlier signing-blocker checklist items for Atlas
1.0. The selected Windows x64 NSIS distribution is intentionally unsigned and
may cause SmartScreen or Unknown Publisher warnings. Publish its SHA-256 checksum
and describe the open-source/source-verifiable status factually; do not represent
this as equivalent to Authenticode signing. Trusted Windows code signing is
POST-1.0 / SHOULD FIX if adoption warrants it.

- [ ] Build and distribute NSIS only; do not build or publish MSI for 1.0.
- [ ] Record and publish the selected NSIS SHA-256 with the installer.
- [ ] Before owner-approved publication, manually observe the clean-profile
  native picker, backend authorization, first index, Ask, Find, Evidence,
  pinning, close, and relaunch. This flow was unobserved in the final automation
  pass and was neither bypassed nor simulated.

## Grounding-regression release gate (2026-09-07)

The previously retained NSIS candidate must not be published: real clean-profile
QA found a no-evidence/grounding defect in it. The post-fix candidate must meet
all of the following before the owner changes the release decision:

- [ ] Install the rebuilt Windows x64 **NSIS only** candidate in the isolated clean profile and perform its normal v5 index rebuild.
- [ ] Verify `How does Kubernetes schedule pods across nodes?` returns the explicit insufficient-workspace-evidence response with zero considered evidence; generation must be skipped absent a relevant pin.
- [ ] Verify current authorization/indexing answers do not cite retired Graph or Insights product surfaces.
- [ ] Pin the actual workspace authorization source and verify the answer is primarily grounded in that selected source, with no unrelated outbound-credential discussion.
- [ ] Record the new installer SHA-256, retain the unsigned/SmartScreen warning disclosure, and do not publish MSI, enable updater, or broaden platforms.

### Agent-run evidence (2026-09-12)

The rebuilt candidate checksum matched and a real isolated profile completed the
v5 index at **116 files / 1,202 chunks**. Production retrieval returned
Kubernetes `none` with zero sources and current-only authorization/indexing
evidence. Desktop UI automation was unavailable, so leave the interactive
grounding, pinning, Evidence, and normal-relaunch items unchecked until their
rendered behavior is directly observed. This is not a signing blocker.

## Lance index-recovery release gate (2026-09-12)

This section supersedes any earlier checkpoint that implies that Windows signing
is an Atlas 1.0 blocker. Atlas 1.0 ships unsigned by owner decision; SmartScreen
and Unknown Publisher warnings are expected. Do not obtain a certificate or
generate a self-signed production certificate. Publish the selected SHA-256 and
do not present it as Authenticode signing. Trusted signing remains POST-1.0 /
SHOULD FIX.

Legitimate native first-index QA found a missing Lance fragment in the
persistent shared dimension table (`atlas_v2_1536`), causing `0 files / 0
chunks`. The replacement candidate is unsigned x64 **NSIS only**:
`release-candidates/Atlas_1.0.0_x64-setup-index-recovery-fix.exe`, SHA-256
`85ECC37CE577BF375B26BE0961EE3A9032FFDC82FCC2390A211F3D2B7C4D7371`.

- [x] Preserve the damaged generated-table/manifests/authorization evidence without deleting `.atlas` or source workspaces.
- [x] Build and silently install the recovery candidate; installer exit code was 0 and `app.exe` reports 1.0.0 / `NotSigned`.
- [x] Pass desktop 36/36, Rust 47/47, strict Clippy, retrieval gate, Turbo, version, notices, and diff checks.
- [ ] In the installed v6 candidate, use the real picker to select Atlas and visibly observe damaged-index recovery/first indexing with `nomic-embed-text:latest`; record final files/chunks.
- [ ] Verify authorization Ask and indexing follow-up are current/grounded; Kubernetes returns the explicit no-evidence response with zero evidence; pin `workspace.rs`; inspect Evidence; close/relaunch.

Until the two rendered native checks pass, the release decision is **NO-GO**.
The outstanding issue is functional runtime evidence, not Windows signing.

## Pinned-context / retrieval-fixture final gate (2026-09-12)

Native post-recovery evidence closed the Lance recovery and Kubernetes grounding
defects at **116 files / 1,221 chunks**. The remaining v7 gate is deliberately
narrow and does not make unsigned distribution a blocker.

- [x] Add coverage for canonical pinned paths, pin priority, bounded
  source-directed context, source-type evidence, and exact fixture exclusion
  (desktop 37/37; Rust 52/52; retrieval 5/5 negatives).
- [x] Exclude only `apps/desktop/src-tauri/fixtures/retrieval/evaluation.json`
  from normal workspace indexing; retain ordinary source, tests, and docs.
- [ ] Build/install the new unsigned Windows x64 **NSIS-only** v7 candidate and
  perform a normal reindex to remove any existing synthetic fixture rows.
- [ ] Verify authorization evidence has `workspace.rs` but not `evaluation.json`;
  verify current indexing follow-up and Kubernetes zero evidence.
- [ ] Pin `apps/desktop/src-tauri/src/workspace.rs`, use the source-directed
  prompt, inspect its Evidence path/content/range, then close/relaunch and
  verify persistence without unexpected reindex.

Do not publish, enable the updater, build/distribute MSI, or broaden platform
support until these rendered v7 candidate checks are complete.

The v7 candidate is built and installed:
`release-candidates/Atlas_1.0.0_x64-setup-pinned-context-fix.exe`, SHA-256
`F398D5E3075EC27333D85805E70D5AB16DA0A6487956E831E26C50B3D6FB14B8`, version
1.0.0 / `NotSigned`, installer exit 0. Leave the rendered v7 runtime boxes
unchecked: the available computer-control provider exposed no native Atlas
window. Automated gates passed (desktop 37/37, Rust 52/52, retrieval 5/5
negatives, strict Clippy, frontend/Turbo, version/notices/diff).

## Source-grounded answer discipline final gate (2026-09-12)

The final generation-only repair is documented in
[`atlas-1.0-source-grounding-final-fix.md`](../audits/atlas-1.0-source-grounding-final-fix.md).
It does not change retrieval or index pipelines; it labels prompt evidence by
source kind and gives implementation code priority for implementation questions.

- [x] Add prompt-contract coverage for implementation-vs-doc/design/test
  authority, source metadata, pinned priority, fixture exclusion, and unchanged
  no-evidence behavior (desktop 37/37; Rust 56/56; retrieval 5/5 negatives).
- [x] Build the unsigned Windows x64 **NSIS-only** source-grounding candidate:
  `release-candidates/Atlas_1.0.0_x64-setup-source-grounding-final.exe`, SHA-256
  `07213A8FCA0F9E7E6812126F53EA674E5466BBB28AD4BDBB1134ABAA0CA08BB8`.
- [ ] Install/observe that candidate through the real native UI. Verify precise
  `canonical_workspace`/`authorized_file`/registry distinctions, code-first
  indexing explanation, Kubernetes zero evidence, pinned `workspace.rs`,
  Evidence path/range/content, and normal restart persistence.

The controller currently has no native Atlas window surface. Do not check the
last item, publish, enable the updater, build/distribute MSI, or broaden
platform support until direct rendered validation is complete.

## Fabricated source-code final closure (2026-09-12)

The final generation-only blocker was a model-generated fenced Rust excerpt that
was not present in the supplied workspace evidence. This is now prevented by a
deterministic final-output check: non-example fenced source code is retained only
when it is an exact contiguous substring of the evidence supplied to that response
(with line-ending/trailing-whitespace normalization only). An unverified block is
removed before Markdown rendering while grounded prose and citations stay intact.

- [x] Reproduce the `start_indexing_internal` answer shape with the fabricated
  `state.active_workspace_id` line and verify it is removed deterministically.
- [x] Verify exact automatic and pinned source excerpts remain renderable; verify
  an unsupplied or mixed invented block is removed.
- [x] Pass desktop 37/37, Rust 66/66, fmt/check/strict Clippy, Vite/Turbo,
  version/notices/diff, and retrieval Hit@5 1.0 / nDCG@5 0.9959934 / negatives 5/5.
- [x] Build the final unsigned Windows x64 **NSIS-only** candidate:
  `release-candidates/Atlas_1.0.0_x64-setup-final.exe`, SHA-256
  `FD73D54CEF9EE057B1F6C5E05D48E2E5C569A29B3963729C3BC10D008C584D3C`.

This deterministic guard closes the final fabricated-code condition; another normal
manual prompt-by-prompt QA cycle is not required for it. **Release decision: GO**
for Atlas 1.0.0 unsigned Windows x64 NSIS. Continue to leave updater disabled; do
not build/distribute MSI, broaden platforms, commit, tag, push, or publish until
the owner separately executes the release steps.
