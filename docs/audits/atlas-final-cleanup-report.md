# Atlas Final Cleanup Report

**Assessment date:** 2026-09-07 (Asia/Calcutta)
**Repository:** `<repository-root>`
**Target:** Atlas `1.0.0`, Windows x64 NSIS

## A. Baseline

- HEAD: `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a`.
- The initial `git status --short` showed substantial pre-existing modified,
  deleted, and untracked Phase 1-4/release work. It was preserved throughout.
- Initial repository size: **73.71 GB**.
- No `git reset`, `git clean`, checkout, history rewrite, commit, push, tag, or
  publication operation was used.

## B. Disk Usage Breakdown Before Cleanup

| Path | Size | Tracked? | Regenerable? | Action |
| --- | ---: | --- | --- | --- |
| `apps/desktop/src-tauri/target/` | 57.31 GB | Ignored | Yes | Removed after retaining the NSIS candidate |
| `apps/desktop/src-tauri/target-codex/` | about 14.97 GB | Ignored | Yes | Removed |
| `website/node_modules/` | 0.48 GB | Ignored | Yes | Removed and restored from `package-lock.json` |
| `node_modules/` | 0.24 GB | Ignored | Yes | Removed and restored from `pnpm-lock.yaml` |
| `website/.next/` | 0.18 GB | Ignored | Yes | Removed and regenerated |
| `.turbo/` | 0.09 GB | Ignored | Yes | Removed and regenerated as needed |
| `.git/` | 0.43 GB | Protected | No | Kept untouched |

The pre-cleanup Rust output was dominated by debug libraries and symbols,
including `app_lib.lib`, PDB files, and Lance/DataFusion artifacts. No source,
documentation, user workspace, lockfile, manifest, or Git data was removed.

## C. Cleanup Actions

Removed only the following confirmed ignored build/cache directories:

- `apps/desktop/src-tauri/target-codex/`
- `apps/desktop/src-tauri/target/`
- `node_modules/`
- `apps/desktop/node_modules/`
- `website/node_modules/`
- `website/.next/`
- `.turbo/`

Before removing `target/`, the current selected NSIS candidate was moved to
`release-candidates/Atlas_1.0.0_x64-setup.exe`. Its SHA-256 remained
`B294FDC762663B3221E1EEDA8F098677BB885F44CC42E9EB36D315766F256072`.
The MSI diagnostic artifact was not retained; MSI is not an Atlas 1.0 release
format.

## D. Protected Items

`.git` was not modified destructively. Source, documentation, audit reports,
lockfiles, manifests, installer configuration, and all pre-existing untracked
application/report work were retained. The owner's Atlas profile was restored
exactly to these inspected locations:

- `%USERPROFILE%\.atlas` (60,617,695 bytes)
- `%APPDATA%\Atlas` (53,582,608 bytes)
- `%LOCALAPPDATA%\com.atlas.desktop` (220,821,765 bytes)

## E. Size Result

- Before cleanup: **73.71 GB**
- Immediately after cleanup, before required rebuild verification: **0.46 GB**
- After dependency restoration and all required verification: **20.22 GB**
- Net removed: **53.49 GB**
- Reduction: **72.57%**

The regenerated `apps/desktop/src-tauri/target/debug/` is 19.01 GB. That is
expected after full Cargo check, Clippy, test, and evaluator runs; it is still a
fully regenerable development artifact.

## F. Rebuild Verification

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, 388 packages restored |
| `npm ci` in `website` | PASS; website uses its independent `package-lock.json` |
| Desktop Vitest | PASS, 8 files / 36 tests |
| Website Vitest | PASS, 2 files / 4 tests |
| Desktop ESLint and TypeScript/Vite build | PASS, 2,009 modules |
| Website ESLint, `tsc --noEmit`, Next build | PASS |
| `cargo fmt --check` | PASS |
| `cargo check --all-targets` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test --all-targets` | PASS, 38 passed; evaluator test intentionally ignored in this command |
| `pnpm retrieval:eval` | PASS; Hit@5 1.0, nDCG@5 0.9959933758, negative rejection 1.0 |
| `pnpm build` | PASS, Turbo 1/1 |
| `pnpm version:check -- --expected 1.0.0` | PASS |
| `pnpm notices:check` | PASS |
| `git diff --check` | PASS; existing CRLF warnings only |

## G. Clean Profile First Run QA

The actual profile locations above were inspected rather than assumed. They were
moved into `%TEMP%\atlas-clean-profile-qa-20260907-0130`, and the existing
unsigned NSIS candidate installed successfully with exit code 0 into a clean
profile. The installed `app.exe` launched.

The available computer-control surface exposed no native Windows application
windows even while the installed process was running, so the empty Launcher,
native folder picker, Rust authorization, first indexing, Ask, Find, Evidence,
pinning, and relaunch persistence could not be directly observed. No workspace
path was injected into persistence and no authorization boundary was bypassed.
The owner profile was restored; generated clean-profile data was retained in the
temporary QA staging location rather than deleting data outside the repository.

**Result: UNOBSERVED, not passed and not claimed as passed.**

## H. Final Release Blocker State

The owner has explicitly accepted unsigned Windows distribution for Atlas 1.0.
The NSIS installer is unsigned and may produce SmartScreen or Unknown Publisher
warnings. It is source-verifiable and its SHA-256 is recorded above, but this is
not equivalent to Authenticode signing. Trusted Windows signing is a POST-1.0
should-fix investment if adoption warrants it; it is not an Atlas 1.0 blocker.

The unobserved native clean-profile picker/first-index flow remains a release
condition for owner/manual confirmation. It is a QA evidence gap, not a proven
functional or security defect.

## I. Remaining Release Conditions

1. Manually observe the clean-profile native picker through first index, Ask,
   Find, Evidence, pinning, and relaunch on the selected NSIS candidate.
2. Publish the recorded SHA-256 beside any later NSIS download.
3. Keep updater disabled. Do not publish Linux or macOS packages for 1.0.

## J. Files Changed by This Session

- `docs/audits/atlas-final-cleanup-report.md` (new)
- `docs/audits/atlas-1.0-release-readiness-report.md` (decision addendum)
- `docs/audits/atlas-1.0-release-blocker-closure-report.md` (decision addendum)
- `docs/release/atlas-1.0-release-checklist.md` (decision addendum)
- `release-candidates/Atlas_1.0.0_x64-setup.exe` (preserved existing NSIS candidate)

All other modified, deleted, and untracked paths pre-dated this session and were
preserved.

## Grounding-regression follow-up (2026-09-07)

The cleanup result and protected-item policy remain unchanged. A later
clean-profile QA observation found a pre-fix retrieval blocker, so a fresh NSIS
candidate must be rebuilt after the source-only grounding repair. This did not
authorize a workspace by editing persistence, delete profile data, or modify
`.git`. See `atlas-1.0-grounding-regression-fix.md` and
`atlas-1.0-final-release-validation.md` for the post-cleanup validation state.
