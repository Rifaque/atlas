# Atlas 1.0 Release Blocker Closure Report

**Assessment date:** 2026-09-07 (Asia/Calcutta)
**Repository:** `<repository-root>`
**Baseline HEAD:** `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a`
**Target:** Atlas `1.0.0`, Windows x64
**Final recommendation:** **NO-GO**

## A. Executive Summary

One of the three original blockers is closed. Atlas now has a generated,
locked-graph third-party notice artifact that is bundled and was verified after
installation. The NSIS installer also completed install, installed-binary runtime,
persistence, reinstall, uninstall, and reinstall-after-uninstall testing.

Atlas still cannot responsibly be released. No production Windows signing identity
or signing secrets are configured, so the final candidate is unsigned. In addition,
the installed clean-profile native picker and first-index path could not be driven by
the available automation surface. Signing and that remaining installed first-run
path are release blockers. No publication operation was performed.

## B. Baseline

The pass started from HEAD
`d3f8215c4c853a3f832c9cc3d4dd57a0850b332a` and the prior **NO-GO** decision.
The original blockers were Windows Authenticode signing, installed-installer
lifecycle QA, and complete artifact-level third-party notices. The working tree had
121 modified, deleted, or untracked paths before blocker work; these comprised the
preserved Phase 1-4/release-readiness work and pre-existing user changes. No reset,
clean, checkout, or broad restoration was used.

## C. Windows Signing

### Classification

**NOT CONFIGURED; blocker OPEN.**

Concrete evidence:

- `apps/desktop/src-tauri/tauri.conf.json` contained no certificate thumbprint,
  custom signing command, or timestamp configuration at baseline.
- both `CurrentUser/My` and `LocalMachine/My` contained zero code-signing
  certificates on the QA machine;
- no Atlas/Windows signing environment variables were present;
- authenticated `gh secret list --app actions` returned no repository Actions
  secrets, and the release workflow previously referenced only `GITHUB_TOKEN`;
- the rebuilt installer and installed executable both report `NotSigned` through
  `Get-AuthenticodeSignature`.

### Configuration prepared

- `scripts/sign-windows.ps1` signs with SHA-256 Authenticode and an RFC 3161
  timestamp, then fails unless Windows reports `Valid`, the signer subject includes
  the configured publisher, and a timestamp certificate exists.
- `apps/desktop/src-tauri/tauri.windows-signing.conf.json` connects that script to
  Tauri's Windows signing command.
- `.github/workflows/release.yml` now fails closed unless
  `WINDOWS_CODESIGN_PFX_BASE64`, `WINDOWS_CODESIGN_PFX_PASSWORD`,
  `WINDOWS_CODESIGN_SUBJECT`, and `WINDOWS_CODESIGN_TIMESTAMP_URL` exist. It decodes
  the PFX only under `RUNNER_TEMP` and removes the exact temporary file in an
  `always()` step.
- `docs/release/windows-code-signing.md` documents the local and CI procedure.

The complete Tauri build was also invoked with the signing overlay and no
credentials. Verbose output confirmed Tauri resolved the repository script and the
build stopped at the signing step with the intended configuration error. No
certificate, private key, secret value, or self-signed substitute was
created or committed. Artifact signature verification therefore remains a required
release-day operation after legitimate production material is supplied.

## D. Installer Lifecycle QA

### Installer tested

The selected release format was the x64 NSIS candidate
`Atlas_1.0.0_x64-setup.exe`. The MSI was also attempted to determine whether it
should ship.

### Fresh install and installed runtime

- Pre-install inspection found no Atlas installation and no running installed Atlas
  process. Four existing Atlas profile/data locations were copied to an isolated
  backup before testing.
- NSIS silent install exited `0`; the HKCU uninstall entry reported Atlas `1.0.0`,
  publisher `Rifaque`, and install location
  `%LOCALAPPDATA%\Atlas`. Desktop and Start Menu shortcuts existed.
- The installed `app.exe` launched. Against the already legitimately authorized
  Janbros workspace it showed `Index ready` and `Local · Ollama`.
- Local Ask completed with eight supplied evidence items; a follow-up completed;
  Evidence opened the requested source and correct line range; Find returned ten
  ranked passages; a source was pinned and removed; History and Settings opened.
- The exact final rebuilt candidate was installed again and exercised through a
  new local Ask (`Where is the navigation structure documented?`), eight evidence
  items, Evidence opening, Find results, and process restart.

### Persistence, reinstall, uninstall, and recovery

- Restart restored the authorized workspace, healthy index, and chat history.
- Reinstalling 1.0.0 over 1.0.0 exited `0` without losing the profile, history, or
  index.
- NSIS uninstall exited `0` and removed the install directory, HKCU uninstall
  entry, Start Menu shortcut, and Desktop shortcut.
- The workspace sentinel `docs/DESIGN_DECISIONS.md` remained unchanged (SHA-256
  `3478E372499125BE1D8AF17C27F421222B36F48AE3F75402C950DEFC240ED789`).
- Atlas profile/index data intentionally survived uninstall, matching the README.
- Reinstall-after-uninstall recognized the retained profile and index safely.
- At completion, the final test installation was removed and the exact pre-QA
  profile backup was restored; post-QA profile data remains isolated in `%TEMP%`.

### Remaining first-run gap and blocker state

A clean-profile installed launch displayed the empty launcher. Settings opened,
Models & Privacy rendered, and Ollama's connection test returned `Ollama responded`.
The available native-computer control surface exposed no native app window, so the
Windows folder picker could not be operated. The Rust authorization boundary was
not bypassed. Consequently, native picker authorization and the first indexing flow
were not observed from a clean installed profile.

**Blocker state: OPEN.** The broad installer lifecycle is now proven, but the task's
required clean-profile native picker/authorization/first-index evidence is still
missing. A signed candidate must complete that path before release.

## E. Installer Format Recommendation

**Distribute NSIS only for Atlas 1.0.0.** It is a per-user installer, required no
elevation in this environment, and completed the lifecycle above. The MSI attempted
an all-users install and rolled back with Windows Installer error 1925/1603 because
the non-administrative process lacked privileges. No MSI installed-app entry was
left. Publishing both adds an unverified elevated path and maintenance burden with
no demonstrated 1.0 benefit. The release workflow now requests NSIS only.

## F. Third-Party Notices

### Inventory and obligations

`scripts/generate-third-party-notices.mjs` builds the notice artifact from the
locked production JavaScript graph and Cargo's normal dependency graph for
`x86_64-pc-windows-msvc`. It excludes development-only JavaScript packages,
build-only Rust edges, Atlas itself, external prerequisites such as Ollama/WebView2,
and material not distributed in the desktop package.

The generated inventory covers 104 JavaScript packages and 593 Rust crates. It
records each component's version, declared SPDX expression, attribution metadata,
and project link, then reproduces package-supplied license and NOTICE texts with
identical texts deduplicated. Declared licenses include MIT, Apache-2.0, BSD, ISC,
Unicode, Zlib, CC0, and MPL-2.0/options; no dependency declares GPL, LGPL, or AGPL.
MPL cases remain subject to the obligations of their selected/distributed form;
this is an engineering inventory, not legal advice.

### Artifact and verification

- `THIRD_PARTY_NOTICES.md` is the generated notice artifact;
- `NOTICE` explains the Atlas/project notices and points to the full artifact;
- `pnpm notices:check` fails if the generated artifact drifts from either locked
  production graph;
- Tauri resources install root `LICENSE` as `LICENSE.txt` and include
  `THIRD_PARTY_NOTICES.md`;
- the installed NSIS package contained both files; the installed and repository
  notices shared SHA-256
  `68919723BA141673E291C47C27CF0F97216DDD095084AB002FEE549097F3E4C6`.

**Blocker state: CLOSED** for the selected NSIS distribution. Project counsel may
still review ambiguous licenses before publication, but no known notice omission is
being hidden or reclassified as closed without an artifact check.

## G. Final Candidate Artifacts

| Artifact | Format | Size | SHA-256 | Signed | Runtime tested |
| --- | --- | ---: | --- | --- | --- |
| `Atlas_1.0.0_x64-setup.exe` | NSIS | 25,228,537 bytes | `B294FDC762663B3221E1EEDA8F098677BB885F44CC42E9EB36D315766F256072` | No (`NotSigned`) | Yes, exact rebuilt candidate |

An unsigned MSI diagnostic artifact remained locally at 42,242,048 bytes, SHA-256
`E15FA7A6FD09B9A315FAD57B03A94E894F7D66ED6351FDECBCDF7909FACFFE81`.
It is not a final candidate, failed non-elevated installation, and is excluded from
the release workflow.

## H. Quality Gates

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| desktop Vitest | PASS — 36/36 in 8 files |
| desktop ESLint | PASS |
| desktop TypeScript + Vite production build | PASS — 2,009 modules |
| website Vitest | PASS — 4/4 in 2 files |
| website ESLint / TypeScript / Next production build | PASS |
| root Turbo build | PASS — 1/1 task |
| `cargo fmt --check` | PASS |
| `cargo check --all-targets` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test --all-targets` | PASS — 38/38 unit tests; evaluation test intentionally ignored here |
| `pnpm version:check -- --expected 1.0.0` | PASS |
| `pnpm notices:check` | PASS |
| release workflow YAML parse/static inspection | PASS; workflow not triggered |
| `git diff --check` | PASS; line-ending warnings only |
| unsigned NSIS release build | PASS |

The embedding-backed evaluator was moved from an application binary target to an
ignored integration test. This prevents Tauri from bundling a stale
`retrieval_eval.exe` and makes the evaluator use the desktop crate's locked graph.

## I. Retrieval Gate

`pnpm retrieval:eval` ran ten queries with local Ollama and
`nomic-embed-text:latest`. It passed the unchanged thresholds:

- Hybrid Hit@5: `1.0` (required `1.0`);
- Hybrid nDCG@5: `0.9959933758` (required at least `0.95`);
- negative-query rejection: `1.0` (required `1.0`).

## J. Security/Privacy Regression

The Rust suite passed workspace canonicalization/traversal, outbound full-payload
secret scanning, explicit cloud authorization, credential allowlisting, and
index-transaction tests. No arbitrary shell IPC or unrestricted mutation command
was reintroduced. Credentials remain Rust-owned, updater UI remains disabled, and
the build contains a CSP. OpenRouter was not invoked because no credential was
available. The release workflow fails closed rather than emitting an unsigned
production artifact when signing secrets are absent.

## K. Original Blocker Status

| Blocker | Before | After | Evidence |
| --- | --- | --- | --- |
| Windows signing | OPEN | **OPEN** | No certificate/secrets; candidate and installed executable `NotSigned`; fail-closed plumbing prepared |
| Installed installer lifecycle | OPEN | **OPEN** | NSIS lifecycle and installed retained flow pass, but clean-profile native picker/first index unobserved |
| Third-party notices | OPEN | **CLOSED** | Locked inventory generated, bundled, installed, and hash-matched |

## L. New Issues Found

1. A stale release-mode `retrieval_eval.exe` could be swept into a Tauri bundle.
   The evaluator is now an ignored integration test and only `app` is an application
   binary target.
2. A standalone evaluator manifest resolved newer AWS crates requiring Rust 1.94.1,
   breaking the declared Rust 1.93 environment. Sharing the desktop Cargo lock fixed
   that reproducibility defect.
3. The MSI's all-users install requires privileges not available to the intended
   per-user path. It is removed from the 1.0 release workflow.

All three were corrected or removed from the selected release path; none adds a
new release blocker beyond the two open original blockers.

## M. Remaining SHOULD FIX

Five prior should-fix items remain: inspect the draft CI artifact on the reviewed
commit, run RustSec auditing in a controlled environment, remove or replace two
unreferenced legacy thumbnail images, exercise migration with genuine historical
state copies, and remove disposable QA/copy directories when the owner has reviewed
them. These do not override the two blockers.

## N. Remaining POST-1.0

Six items remain: Linux native packaging/QA, macOS packaging/signing/notarization,
signed updater infrastructure, in-app Atlas-data purge, broader retrieval corpora,
and model-specific token accounting/claim-level citation semantics.

## O. Final Release Recommendation

**NO-GO.** The current unsigned Atlas 1.0.0 Windows artifact must not be published.
Obtain and verify the production signing identity, then run the signed NSIS package
through the clean-profile native picker, authorization, first-index, retained
workflow, restart, and uninstall. A GO decision requires both remaining blockers to
be closed with the exact signed candidate.

## P. Exact Release Procedure

1. Obtain the approved production Authenticode PFX, expected publisher subject,
   password, and trusted RFC 3161 timestamp URL outside Git.
2. Configure the four documented Actions secrets and review the intended release
   commit; keep the updater disabled.
3. Run all checklist gates, including notice drift, version consistency, and local
   Ollama retrieval evaluation.
4. Run the release workflow without a tag to produce a signed NSIS artifact; verify
   installer and installed executable signatures, publisher, timestamp, version,
   hash, LICENSE, and notices.
5. Install that exact artifact on a clean Windows profile. Use the native picker,
   authorize a safe workspace, index it, Ask, follow up, Find, inspect Evidence,
   pin/remove Context, restart, and uninstall. Confirm source files are untouched.
6. Update this report to close both blockers. Only then commit approved release
   changes, create `v1.0.0`, push, inspect the draft GitHub Release, and obtain owner
   approval before publication.

No step in item 6 was executed by this pass.

## Q. Files Changed

### Blocker-closure changes

- Signing: `.github/workflows/release.yml`,
  `apps/desktop/src-tauri/tauri.windows-signing.conf.json`,
  `scripts/sign-windows.ps1`, `docs/release/windows-code-signing.md`.
- Notices/package: `scripts/generate-third-party-notices.mjs`,
  `THIRD_PARTY_NOTICES.md`, `NOTICE`, `apps/desktop/src-tauri/tauri.conf.json`,
  `package.json`, `README.md`, `CHANGELOG.md`.
- Release binary hygiene/evaluation: `apps/desktop/src-tauri/Cargo.toml`,
  `apps/desktop/src-tauri/tests/retrieval_eval.rs`, `BUILD.md`.
- QA/reporting: `scripts/inspect-installed-atlas.mjs`, this report,
  `docs/audits/atlas-1.0-release-readiness-report.md`, and
  `docs/release/atlas-1.0-release-checklist.md`.

### Pre-existing work preserved

All Phase 1-4 and release-readiness application, test, documentation, website,
workflow, dependency, deletion, and untracked changes that existed at task start
remain preserved, including crucial `agents.md`. The task did not reset, clean,
force-checkout, commit, push, tag, trigger a workflow, create a release, upload an
artifact, publish, or enable the updater.

## Subsequent owner decision (2026-09-07)

This report's earlier Windows-signing blocker classification is superseded. The
owner accepts unsigned Windows x64 NSIS distribution for Atlas 1.0. SmartScreen
and Unknown Publisher warnings are an accepted limitation. A SHA-256 checksum
must be published, and the open-source package remains source-verifiable; these
do not provide Authenticode's publisher identity or reputation. Trusted signing
is POST-1.0 / SHOULD FIX if adoption warrants it.

The clean-profile native picker and first-index workflow remains unobserved in
the available native-app automation surface. It was not bypassed or simulated.
The final cleanup and all regenerated-build results are recorded in
`docs/audits/atlas-final-cleanup-report.md`.
