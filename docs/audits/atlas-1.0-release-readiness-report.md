# Atlas 1.0 Release Readiness Report

**Assessment date:** 2026-09-06 (Asia/Calcutta)
**Repository:** `<repository-root>`
**Baseline HEAD:** `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a`
**Target:** Atlas `1.0.0`
**Recommendation:** **NO-GO**. A 2026-09-07 blocker-closure pass closed the
third-party-notices blocker; Windows signing and installed clean-profile
picker/first-index QA remain open. See the addendum below and the dedicated
blocker-closure report.

## A. Executive Summary

The source tree is substantially closer to a reproducible Atlas 1.0 release. All
current application version surfaces now agree on `1.0.0`; a drift check is wired
into CI; desktop, website, Rust, retrieval, clean-copy, and Windows bundle builds
pass; and an unsigned NSIS installer plus MSI were generated and inspected. The
release executable successfully exercised a real authorized, indexed workspace
through Ask, follow-up, Find, Evidence, Context, History, Settings, and restart.

Atlas must not yet be published. The Windows packages have no Authenticode
signature or configured signing workflow, the produced installers were not
installed/uninstalled on this machine, and the distributable does not yet carry a
complete generated third-party license bundle. The updater correctly remains
disabled. Linux is configured but unverified and excluded from the 1.0 release
workflow; macOS is unsupported for this release.

The repository was already very dirty. Phase 1-4 changes and unrelated user work
were preserved. No reset, clean, checkout, commit, push, tag, workflow trigger, or
release publication occurred.

### Blocker-closure addendum — 2026-09-07

The follow-up pass materially advanced, but did not fully close, release readiness:

- **Windows signing remains OPEN.** No production code-signing certificate exists
  in either Windows certificate store, no signing environment values were present,
  and the repository's Actions secret inventory contained no signing secrets. The
  workflow now fails closed unless four documented production secrets are supplied,
  and the signing adapter verifies signature validity, publisher subject, and RFC
  3161 timestamp. The final local candidate is still `NotSigned`.
- **Installed lifecycle remains OPEN.** The final NSIS candidate completed install,
  real installed-binary Ask/Find/Evidence, persistence, same-version reinstall,
  uninstall, and reinstall-after-uninstall. A clean-profile launch and Ollama check
  passed, but native picker automation was unavailable, so clean-profile native
  authorization and first indexing were not observed from the installed package.
  The MSI failed its non-elevated all-users install with Windows Installer error
  1925/1603; Atlas 1.0 should ship NSIS only.
- **Third-party notices are CLOSED.** `THIRD_PARTY_NOTICES.md` inventories 104
  production JavaScript packages and 593 Windows runtime Rust crates, includes
  available package license/notice texts, passes a locked-graph drift check, and is
  bundled beside `LICENSE.txt`. The installed notices SHA-256 matched the reviewed
  repository file exactly.

The rebuilt NSIS candidate is
`Atlas_1.0.0_x64-setup.exe`, 25,228,537 bytes, SHA-256
`B294FDC762663B3221E1EEDA8F098677BB885F44CC42E9EB36D315766F256072`.
It is not a publishable artifact because it is unsigned. The recommendation remains
**NO-GO with two blockers**. Full evidence and the exact remaining procedure are in
`docs/audits/atlas-1.0-release-blocker-closure-report.md` and the updated release
checklist.

## B. Current Version State

At the start of this pass, desktop package, Cargo package, Tauri configuration,
and the Settings UI identified the product as `1.0.1`; root package metadata did
not own an authoritative product version. Historical/current docs also contained
`0.9.2` and `0.10.0` references. The remote release API reported only published
releases `v0.9.2` (2026-03-06) and `v0.1.4` (2026-02-22), while local/remote tag
inspection found no genuine `v1.0.0` release.

Final maintained release surfaces:

| Surface | Final value |
| --- | --- |
| Root `package.json` | `1.0.0` |
| Desktop `package.json` | `1.0.0` |
| Rust `Cargo.toml` | `1.0.0` |
| Rust `Cargo.lock` application package | `1.0.0` |
| `tauri.conf.json` | `1.0.0` |
| Settings About text | `Atlas 1.0.0` |
| Changelog current heading | `1.0.0 - Unreleased` |

The standalone marketing website package remains internally versioned `0.1.0`;
that is the website package version, not the Atlas desktop release version. The
site obtains actual desktop release versions from GitHub Releases.

## C. Final Version Decision

The authoritative release version is **1.0.0**. Repository tags and the GitHub
Releases API establish that it has not previously been published. No tag was
created. `scripts/check-version.mjs` now checks root, desktop, Cargo manifest,
Cargo lockfile, Tauri, Settings, Changelog, and an optional expected tag version.
It passes at `1.0.0` and demonstrably rejects a mismatched expected version.

## D. Supported Platforms

| Platform | Build | Package | Native QA | Signing | Release Status |
| -------- | ----- | ------- | --------- | ------- | -------------- |
| Windows 10/11 x64 | VERIFIED | NSIS VERIFIED; MSI excluded | Installed NSIS retained flow/lifecycle verified; clean-profile picker/index incomplete | Plumbing ready, certificate/secrets absent; artifact unsigned | BLOCKED pending signing and final clean-profile QA |
| Linux x64 | Configured, not built in this pass | AppImage/deb commands configured | None | None | CONFIGURED BUT UNVERIFIED; excluded from 1.0 workflow |
| macOS | Not verified | Not in 1.0 workflow | None | No signing/notarization | UNSUPPORTED for 1.0 |

Tauri's general bundle configuration contains cross-platform icon/container
metadata, but that is not treated as proof of support. Current documentation and
the website structured application metadata identify Windows as the verified
platform.

## E. Build & Packaging

Authoritative local Windows command:

```powershell
cd apps/desktop
pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis --config src-tauri/tauri.windows-signing.conf.json
```

The original audit build intentionally proved unsigned NSIS/MSI packaging without
implying that signing existed. Its historical artifacts were:

| Artifact | Bytes | SHA-256 | Signature |
| --- | ---: | --- | --- |
| `target/x86_64-pc-windows-msvc/release/bundle/nsis/Atlas_1.0.0_x64-setup.exe` | 28,077,100 | `ECDFD515930CF5B80C9EF2976884C0B0A9498B1904CB8D8C41AC0FD55D7F840E` | NotSigned |
| `target/x86_64-pc-windows-msvc/release/bundle/msi/Atlas_1.0.0_x64_en-US.msi` | 46,075,904 | `71D963262C527FE1D03A1D22CDF1D3FCCFA25F7A041CC01E8873E894C89016CC` | NotSigned |

The release executable reports product/file version `1.0.0`, product name Atlas,
and description Atlas. Static MSI inspection reports ProductName Atlas,
ProductVersion 1.0.0, Manufacturer Rifaque, and stable UpgradeCode
`{BC378FA4-9BAF-593A-88D6-4DA9BDD2AD34}`.

## F. Installer Audit

`install.ps1` and `install.sh` were misleading historical setup entry points.
They now explicitly identify themselves as developer source-bootstrap scripts,
check Node/pnpm/Cargo/protoc, warn when Ollama is absent, perform a frozen install,
check versions, and build the frontend. The PowerShell bootstrap completed; the
shell script passed `bash -n`. Neither script installs system software or starts
development mode.

At the original audit the NSIS/MSI packages had not been installed. The subsequent
closure pass completed the NSIS install/reinstall/uninstall/reinstall lifecycle and
the retained workflow in the installed binary. MSI rolled back when its all-users
install required unavailable privileges and is excluded from 1.0. The remaining
installer blocker is specifically a clean-profile run through the native picker,
authorization, and first index using the eventual signed NSIS candidate.

## G. Release Workflow

`.github/workflows/release.yml` now separates an Ubuntu quality gate from a
Windows-only packaging job. It uses Node 24, pnpm's frozen lockfile, stable Rust
with rustfmt/Clippy, Linux Tauri build dependencies for the quality job, protoc on
Windows, version/tag consistency, desktop tests/lint/build, Cargo
fmt/check/Clippy/tests, signed Tauri NSIS packaging, artifact upload, and a draft
GitHub Release. Permissions are read-only for quality and contents-write only for
the packaging job. The packaging job now requires production signing secrets and
fails closed if they are missing. YAML parsing succeeds.

Packaging runs only for a tag or manual dispatch. Linux was deliberately removed
from artifact publication because it has not received native QA. No workflow was
triggered, so hosted-runner behavior and external secret availability remain to
be proven on the reviewed release commit.

Website CI performs `npm ci`, lint, typecheck, unit tests, build, and accessibility
smoke testing under Node 24 before preview/production deployment jobs.

## H. Updater Status

**Disabled and safe.** No updater plugin, updater capability, endpoint, public
key, or active updater UI is registered. No updater signing variables were
present in the audit environment. It must remain disabled until a real private
key exists outside the repository, the matching public key and endpoints are
configured, signed update artifacts are generated, and update failure behavior
is validated. No key was generated or committed.

## I. Fresh User Journey

The release executable launched against the new `com.atlas.desktop` WebView
profile and displayed the genuine empty launcher with no recent workspaces. This
validated the no-state first-launch surface. Native UI automation was unavailable
for the Windows folder picker; the release test therefore could not complete the
picker -> first index path in that blank profile.

For the remaining release-mode flow, only the frontend registration for an
already Rust-authorized Janbros workspace was restored. This did not bypass the
backend authorization check. Its healthy index exposed 102 files and 1,270
chunks. Missing-Ollama and missing-model states remain covered by existing UI
tests and prior native QA, not by this final clean-profile walkthrough.

Result: **PARTIAL**. Empty first launch is observed; native first authorization,
first index, and installed-app first run remain checklist items.

## J. Existing User Migration

Automated frontend tests cover workspace-registry migration, workspace-owned chat
history migration/reload, corrupt legacy state, settings migration, and the rule
that secrets are never written to frontend storage. Rust manifest/index health
checks mark pre-v4 retrieval indexes incompatible; index pipeline version 4
requires an explicit rebuild rather than mixed retrieval behavior. Canonical
workspace authorization is persisted by Rust.

The live release walkthrough confirmed current workspace history, a two-turn
conversation, selected Evidence, and one pinned file survived process restart.
A destructive real-profile migration from every historical version was not run;
that remains a should-fix validation item.

## K. Data Locations & Purge

Current Atlas-owned data:

| Location | Contents | Workspace content? | Uninstall expectation |
| --- | --- | --- | --- |
| `~/.atlas/lancedb/` | Indexed chunks, metadata, embeddings | Yes, source excerpts | Expected to survive |
| `~/.atlas/manifests/` | Per-workspace index manifests | Paths/hashes/metadata | Expected to survive |
| `~/.atlas/authorized-workspaces.json` | Canonical authorized roots | Paths | Expected to survive |
| Windows `%LOCALAPPDATA%\\com.atlas.desktop\\EBWebView` | Recent workspaces, settings, UI state, workspace chat history | Yes, chat/evidence references | Expected to survive |
| OS credential store, service `com.atlas.desktop` | OpenRouter credential presence/value | Secret, no workspace text | OS-managed |
| `%LOCALAPPDATA%\\com.atlas.desktop\\logs` | Debug-build logs when enabled | Potentially diagnostic data | May survive |

Observed migration-era locations include `%LOCALAPPDATA%\\com.atlas.app`,
`%APPDATA%\\atlas`, and `~/.atlas/{chats,logs,settings.json,backend-crash.log}`.
Current code does not silently delete them.

Remove from Recent only removes the launcher registration; it does not purge
index/history data. Atlas 1.0 has no in-app purge. README now documents the
distinction and manual locations. Users must close Atlas, back up anything they
need, remove only Atlas-owned state they intend to discard, and never remove the
source workspace. A bounded in-app purge remains post-1.0 work.

## L. Privacy

In Local / Ollama mode, embeddings and prompts go to the configured Ollama host.
The default host is local; a user-configured remote Ollama host is a network
transfer and is described that way. In optional Cloud / OpenRouter mode, the
payload may include the query, retrieved evidence, pinned context, relevant
history, system instructions, and enabled Git context. Rust constructs the one
bounded outbound payload and scans it before transmission. OpenRouter is
workspace-authorized and credentials remain in the OS credential store. Atlas
contains no product telemetry. README, Tauri metadata, website copy, and Settings
use this qualified language; the false unconditional “code never leaves” claim
is absent.

## M. Security Regression Check

PASS by code inspection and retained tests:

- no arbitrary shell or Apply Diff IPC is registered;
- no Tauri shell or broad filesystem permission remains;
- capabilities contain only `core:default` and `dialog:default`;
- file reads use a canonical Rust-authorized workspace root and reject traversal,
  outside-root paths, and symlink escapes;
- the application has a non-null CSP with narrowly scoped local IPC/Ollama
  connectivity;
- OpenRouter credentials are Rust/keyring-owned, never returned casually, and
  excluded from localStorage tests;
- complete cloud payload scanning and explicit authorization tests pass;
- release logging is not enabled, and provider keys are not logged;
- the unsafe updater remains absent.

## N. Documentation

The root README was replaced with the shipped 1.0 product definition, retained
capabilities, qualified privacy model, prerequisites, actual install/release
state, first-run steps, developer setup, build commands, data locations, and
limitations. `BUILD.md` now contains real commands and platform status.
`website/README.md` no longer instructs contributors to use the deleted screenshot
carousel or asset-sync script. Historical audits remain unchanged and explicitly
historical planning documents remain marked as such.

## O. Changelog

`CHANGELOG.md` now has an Unreleased 1.0.0 entry organized around user-visible
Ask/Find/Evidence, safer indexing, workspace isolation, explicit cloud transfer,
BM25 + semantic RRF retrieval, no-evidence behavior, bounded context, security
hardening, and removal of pre-1.0 experiments. It makes no signing/updater or
publication claim.

## P. Assets & Branding

The Tauri icon set is present and structurally valid: PNG sizes from 30 through
512 pixels, a 256-pixel ICO, and a valid 277,003-byte ICNS container. Windows
binary metadata uses Atlas and version 1.0.0. The website uses the current Atlas
icon and a code-rendered product illustration; old screenshot-carousel and Vite
placeholder code/assets were removed.

Two tracked, unreferenced pre-refresh thumbnails remain:
`assets/atlas-thumbnail.png` and `website/public/img/atlas-thumbnail.png`. They do
not ship in the desktop bundle or render on the website, but should be reviewed
and removed or replaced before final repository cleanup.

## Q. License / Notices

The project LICENSE is MIT and carries the 2026 Rifaque Ahmed Akrami copyright.
NOTICE now distinguishes external Ollama from bundled dependencies and records
the bundled website fonts (IBM Plex and Playfair Display, OFL-1.1) in addition to
key Rust/frontend credits. Cargo metadata reported no dependency with missing
license metadata; the dependency graph includes permissive licenses plus a small
number of MPL-2.0 dependencies.

The current summary NOTICE is not a complete artifact-level reproduction of all
required dependency license/copyright texts. A generated, reviewed license bundle
must accompany public binaries. This is a release blocker, not a claim that the
summary alone is sufficient.

## R. Repository Hygiene

Generated desktop `dist`, Cargo `target`, legacy `target-codex`, website `.next`,
and package-manager directories are ignored. `.gitignore` now permits the crucial
tracked `BUILD.md`. Vite/React template SVGs, unused website placeholder SVGs,
the removed screenshot carousel, and its obsolete sync script were deleted.
No generated bundle was added to Git.

The already-dirty worktree remains intentionally dirty. A clean-copy source tree
was created outside the repository for reproducibility testing. Automated policy
prevented its recursive cleanup after validation; it remains at
`%TEMP%\atlas-release-repro-<temporary-id>`
and contains only this task's disposable copy/build output.

## S. Dependency / Reproducibility Findings

No `latest` dependency declarations were found. Root/desktop use pnpm 10.4.1 and
the standalone website intentionally uses npm; both lockfiles are authoritative
and frozen installs pass. Outdated packages were recorded but not broadly
upgraded. The website alone was narrowly upgraded to Next 16.3.4, its matching
ESLint config, PostCSS 8.5.23, and patched transitive dependencies because the
previous production graph had live security advisories. Obsolete
`focus-trap-react` and the legacy ESLint compatibility package were removed.
`npm audit` and `pnpm audit --prod` report no known vulnerabilities. `cargo-audit`
is not installed, so a Rust advisory scan remains a should-fix item.

A source copy excluding `.git`, `node_modules`, `.next`, `dist`, Cargo targets,
coverage, logs, and temporary files passed:

- `pnpm install --frozen-lockfile`;
- root `pnpm build` with a cache miss;
- website `npm ci --ignore-scripts` and `npm run build`;
- a completely fresh `cargo check --all-targets` (1m51s).

This demonstrates the builds do not depend on stale local output, while stopping
short of claiming a second full clean-machine Windows installer cycle.

## T. CI / Quality Gates

The desktop quality job checks frozen dependencies, version/tag drift, notice
drift, frontend tests/lint/build, and Rust formatting/check/Clippy/tests. The
Windows package job is draft-only, requests NSIS only, requires production signing,
and uploads output with missing-artifact failure. The website
workflow checks its independent frozen npm graph, lint, typecheck, unit/a11y tests,
and build. These commands do not require a network Ollama service.

The workflow files were parsed locally and all constituent local commands pass.
The GitHub-hosted workflows were not triggered. Code signing is not represented as
complete; the artifact-level license bundle is now generated and checked.

Final validation ledger:

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --filter desktop test -- --run` | PASS - 36/36 |
| `pnpm --filter desktop lint` | PASS |
| `pnpm --filter desktop build` | PASS - TypeScript + Vite |
| `cargo fmt --all -- --check` | PASS |
| `cargo check --all-targets` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test --all-targets` | PASS - 38/38 |
| `pnpm retrieval:eval` | PASS - 10 queries and all thresholds (moved to a non-bundled integration test during blocker closure) |
| root `pnpm build` | PASS - Turbo 1/1 |
| `npm ci` in `website` | PASS - 0 vulnerabilities |
| website `npm test` | PASS - 4/4 |
| website `npm run test:a11y` | PASS - 1/1 (also included in the four tests) |
| website `npm run lint` | PASS |
| website `npm run typecheck` | PASS |
| website `npm run build` | PASS |
| website `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| `pnpm audit --prod` | PASS - no known production vulnerabilities |
| `pnpm version:check -- --expected 1.0.0` | PASS |
| mismatched `--expected 9.9.9` negative control | PASS - correctly exited 1 |
| `git diff --check` | PASS (line-ending notices only) |
| `powershell -File install.ps1` | PASS |
| `bash -n install.sh` | PASS |
| Windows Tauri NSIS/MSI build | PASS - two unsigned bundles |

The first website lint/typecheck attempt was run concurrently with its Next build:
the old lint adapter failed under Next 16 and generated `.next` types raced the
standalone typecheck. The config was migrated to the supported flat configuration,
the invalid old experimental flag was removed, and build -> typecheck -> lint all
passed sequentially. The failed diagnostic attempt is not counted as a final gate.

## U. Retrieval Evaluation Gate

`retrieval_eval --check` adds release thresholds without pinning floating-point
results exactly:

- Hybrid Hit@5 must be at least 1.0 on the ten-query fixture;
- negative-query rejection must be at least 1.0;
- Hybrid nDCG@5 must be at least 0.95.

The live local-Ollama run passed: Hybrid Hit@5 `1.0`, nDCG@5
`0.9959933758`, MRR `1.0`, Recall@5 `1.0`, and negative rejection `1.0`.
Routine CI retains deterministic offline retrieval unit tests; the embedding-based
evaluation remains a documented pre-release gate because it requires Ollama and a
specific local model.

## V. Release-mode Runtime QA

The unpackaged final release executable was launched from the production target
with local Ollama 0.31.1, `nomic-embed-text:latest`, and `llama3.2:latest`. The
real authorized Janbros workspace reported a healthy 102-file/1,270-chunk index.
Observed flow:

1. Launcher and workspace shell opened with Index ready and Local / Ollama.
2. Ask produced a complete grounded response with eight evidence items.
3. A follow-up question used the existing conversation and returned the directly
   relevant `docs\\DESIGN_DECISIONS.md` range.
4. Evidence opened without discarding the conversation.
5. Find returned ranked `design language` passages and opened a source preview.
6. A result was pinned; `Context - 1 file - Git on` remained visible.
7. History and Settings opened.
8. Process restart restored the workspace, two-turn chat, Evidence state, and
   pinned Context.

OpenRouter was not tested because no credential was available. No secret was
created for QA. Native automation was unavailable through the connected computer
surface, so an established WebView2 inspection fallback exercised DOM actions;
the native backend continued to enforce workspace authorization.

## W. Clean-profile QA

The new desktop identifier's clean WebView profile displayed the empty launcher,
correct open-workspace affordance, and local-first disclosure. The profile was not
destroyed. Native picker control was unavailable, so the first authorization and
index could not be completed in that clean profile. Current state persistence was
verified through a separate release-process restart after the authorized
workspace flow.

Result: **PARTIAL clean-profile simulation**, not a clean-machine installer test.

## X. Blockers

The list below records the original 2026-09-06 assessment. After the 2026-09-07
closure pass, blocker 3 is CLOSED; blockers 1 and 2 remain OPEN for the reasons in
the addendum. The installed lifecycle gap is now narrowly the signed, clean-profile
native picker/authorization/first-index path rather than the broader lifecycle list
originally recorded.

1. **Windows signing is absent.** Both packages are NotSigned; no signing identity
   or CI signing configuration is present.
2. **Installed-installer QA is incomplete.** NSIS/MSI install, Add/Remove Programs,
   first run from the installed location, upgrade, repair/uninstall, and persisted
   data behavior have not been exercised.
3. **Artifact-level third-party notices are incomplete.** A generated and reviewed
   full license/copyright bundle must accompany public binaries.

## Y. Should-Fix Items

1. Run the release workflow manually on the reviewed release commit and inspect
   the draft artifacts before tagging.
2. Run `cargo audit` (or an equivalent RustSec scan) in a controlled environment.
3. Remove or replace the two unreferenced pre-refresh thumbnail PNGs.
4. Exercise one isolated legacy registry/history/index/credential migration using
   real historical state copies.
5. Remove the disposable clean-copy directory noted in section R when local tool
   policy permits.

## Z. Post-1.0 Backlog

1. Linux packaging plus native first-run/runtime validation before Linux support.
2. macOS packaging, CI, signing, notarization, and native validation.
3. Signed automatic updater infrastructure and failure/recovery QA.
4. Explicit in-app purge of Atlas-owned index/history data.
5. Broader retrieval evaluation beyond the current deterministic fixture corpus.
6. Model-specific token accounting and stronger claim-level citation semantics.

## AA. Go / No-Go Recommendation

**NO-GO.** Application code, tests, retrieval behavior, clean-copy builds, and
Windows package generation are in good condition. Publication must wait for a
real Windows signing identity and a signed clean-profile NSIS run through native
workspace selection, authorization, first indexing, and the retained workflow.
Third-party notices and the remainder of the NSIS lifecycle are now verified;
MSI is no longer recommended for the 1.0 distribution. Linux/macOS must not be
advertised or published as verified 1.0 platforms. Once the two remaining blockers
close and the draft CI artifact passes the operational checklist, the evidence
supports a Windows-first 1.0 release.

## AB. Files Changed

### Release-readiness changes

- Version/release control: `package.json`, `apps/desktop/package.json`,
  `apps/desktop/src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}`,
  `apps/desktop/src/components/SettingsModal.tsx`, `scripts/check-version.mjs`,
  `.github/workflows/release.yml`.
- Release/docs/legal: `README.md`, `BUILD.md`, `CHANGELOG.md`, `NOTICE`,
  `install.ps1`, `install.sh`, `docs/todo.md`, this report, and
  `docs/release/atlas-1.0-release-checklist.md`.
- Retrieval release gate: originally `apps/desktop/src-tauri/src/bin/retrieval_eval.rs`;
  the blocker-closure pass moved it to
  `apps/desktop/src-tauri/tests/retrieval_eval.rs` so it cannot be bundled as an
  application binary.
- Website truth/security: `website/{package.json,package-lock.json,next.config.mjs,eslint.config.mjs,tsconfig.json,next-env.d.ts,README.md}`;
  `website/app/{page.tsx,layout.tsx}`; Hero, FeaturePanel, SpecsSection,
  StickyDownloadCTA; `website/lib/{content.ts,types.ts}`; accessibility test;
  deletion of ScreenshotsCarousel, placeholder SVGs, and `sync-assets.sh`.
- Safe template cleanup: deletion of `apps/desktop/public/vite.svg`.
- Ignore rule: `.gitignore` now allows the crucial build guide.

Several files in that list were already dirty from Phase 1-4; release changes
were integrated narrowly rather than replacing prior work.

### Pre-existing work preserved

The start-of-task tree already contained all Phase 1-4 application changes:
indexing transactions/jobs, workspace authorization, credentials/outbound policy,
retrieval v4/evaluation fixtures, Rust domain modules, Ask/Find/Evidence/History
frontend components and tests, capability reductions, removed experimental
features, redesigned styles, current architecture/PRD/benchmark documents, phase
reports/design spec, and the associated dependency/lock changes. It also included
the archived crucial `agents.md`, modified CI/ignore/install/documentation files,
deleted legacy feature files, and untracked generated/source additions recorded
by the prior phase reports.

All unrelated pre-existing modifications, deletions, and untracked files were
preserved. No commit, push, tag, workflow run, or release publication occurred.

## Subsequent owner decision and final-cleanup addendum (2026-09-07)

This addendum supersedes the earlier classification of Windows signing as an
Atlas 1.0 release blocker. The project owner explicitly accepts an **unsigned
Windows x64 NSIS distribution** for this small personal/portfolio/open-source
release. Atlas 1.0 may trigger SmartScreen or Unknown Publisher warnings. It
must publish a SHA-256 checksum and remain source-verifiable; neither property
is equivalent to Authenticode signing. Trusted Windows signing is POST-1.0 / a
SHOULD FIX if adoption justifies the cost.

The final audited NSIS candidate is unsigned and has SHA-256
`B294FDC762663B3221E1EEDA8F098677BB885F44CC42E9EB36D315766F256072`. The
native clean-profile picker, backend authorization, and first-index workflow
remain **unobserved** because the available control surface could not expose a
native application window. No authorization path was bypassed. This is the
remaining QA evidence condition, not a signing blocker. See
`docs/audits/atlas-final-cleanup-report.md` for the cleanup and verification
record.

## Grounding-regression addendum (2026-09-07)

Manual clean-profile QA subsequently found a functional release blocker in the
retained pre-fix candidate: an unrelated Kubernetes query generated a generic
answer from a repeated incidental workspace term, and historical audit text
could appear as current product truth. The issue was reproduced in the real
LanceDB runtime path. The repair is documented in
`atlas-1.0-grounding-regression-fix.md`: conservative multi-term relevance,
no-generation/zero-evidence for weak or none retrieval, archival audit exclusion
for fresh indexes, v5 reindexing, and pinned-context priority.

Automated post-fix gates pass (desktop 36/36; Rust 43/43; hybrid Hit@5 1.0,
nDCG@5 0.9959934, negative rejection 5/5). The release recommendation is
temporarily **NO-GO** only until the rebuilt NSIS candidate is installed,
reindexed, and manually observed for the four grounding cases. The unsigned
Windows policy remains accepted and is not a blocker.

## Agent-run runtime addendum (2026-09-12)

The rebuilt candidate checksum matched. Its installed isolated profile completed
the v5 rebuild at **116 files / 1,202 chunks**. The real profile's production
retrieval path returned Kubernetes `none` with zero sources and current-only
sources for authorization/indexing questions. The environment did not expose a
controllable native Atlas window, so rendered-answer, pin, Evidence, and normal
relaunch observations could not be made. The decision remains **NO-GO pending
UI evidence**, not because of unsigned distribution and not because a new
functional failure was observed.

## Lance index-recovery blocker addendum (2026-09-12)

A subsequent genuine native clean-profile index attempt found a functional
failure in the installed candidate: the shared, dimension-named generated table
`~/.atlas/lancedb/atlas_v2_1536.lance` referenced a missing Lance fragment.
Indexing then failed at `0 files / 0 chunks` while retryable replacement cleanup
was scanning every vector-dimension table. This is the current release blocker;
it is unrelated to the accepted unsigned Windows policy.

The v6 repair records vector-table dimensions in manifests, probes those tables
before an index is reported ready or an unchanged-file pass is skipped, scopes
cleanup to the active dimension, and automatically rebuilds only a damaged
generated table while invalidating manifests that could claim its rows. Legacy
manifests without dimension ownership are conservatively marked incompatible.
Source workspaces, authorization state, and unrelated dimensions are preserved.
See `docs/audits/atlas-1.0-index-recovery-fix.md` for the root cause, state
inventory, recovery policy, and regression tests.

Post-fix automated gates pass: desktop **36/36**, Rust **47/47**, fmt/check/strict
Clippy, Vite/Turbo, version/notices/diff checks, and retrieval Hybrid Hit@5
`1.0`, nDCG@5 `0.9959934`, negative rejection `5/5`. The new unsigned NSIS
candidate is `release-candidates/Atlas_1.0.0_x64-setup-index-recovery-fix.exe`
with SHA-256 `85ECC37CE577BF375B26BE0961EE3A9032FFDC82FCC2390A211F3D2B7C4D7371`;
its silent install completed with exit code 0.

The connected computer-control provider has no Atlas native-window surface, so
the post-fix rendered recovery/index/Ask/Find/Evidence/pin/relaunch workflow
remains unobserved. The recommendation is **NO-GO pending that one functional
runtime observation**. There is one functional blocker; Windows signing is a
documented SHOULD FIX / POST-1.0 limitation, not a blocker.

## Pinned-context / fixture final gate addendum (2026-09-12)

Native post-recovery validation confirmed `ready` at **116 files / 1,221
chunks**, a current indexing answer without retired surfaces, and Kubernetes
insufficient evidence with zero sources. The Lance recovery and unrelated-query
blockers are closed.

One narrowly scoped blocker remains: a pinned-source request could be overridden
by automatic test-code evidence, and Atlas's synthetic
`apps/desktop/src-tauri/fixtures/retrieval/evaluation.json` corpus could be
indexed as product evidence. Pipeline v7 gives source-directed pins primary,
labeled context and excludes only that test corpus. The repair and automated
coverage are in
[`atlas-1.0-pinned-context-final-fix.md`](atlas-1.0-pinned-context-final-fix.md).
Until its rebuilt unsigned x64 NSIS candidate is observed for v7 reindexing,
pinned `workspace.rs`, Evidence, and restart behavior, the recommendation is
**NO-GO** with one functional runtime-validation blocker. Signing is accepted.

The fresh v7 unsigned x64 NSIS-only candidate is
`release-candidates/Atlas_1.0.0_x64-setup-pinned-context-fix.exe`, SHA-256
`F398D5E3075EC27333D85805E70D5AB16DA0A6487956E831E26C50B3D6FB14B8`.
It installed successfully (exit 0) and reports 1.0.0 / `NotSigned`. Desktop
37/37, Rust 52/52, strict Clippy, frontend/Turbo, version/notices/diff, and
retrieval Hit@5 1.0, nDCG@5 0.9959934, negatives 5/5 pass. The available
computer-control provider had no native Atlas surface, so no rendered runtime
claim is made for the new candidate.

## Source-grounded answer discipline gate addendum (2026-09-12)

Correct retrieval evidence was still vulnerable to generation overreach: answers
could conflate the responsibilities of current code functions or present a
design-spec/test symbol as runtime implementation. The narrow source-grounding
repair labels generation context by deterministic source kind and makes current
implementation code primary only for deterministic implementation questions.
It leaves retrieval, no-evidence thresholds, v7 fixture exclusion, pin authority,
and index recovery unchanged.

The source-grounding candidate is unsigned x64 NSIS only:
`release-candidates/Atlas_1.0.0_x64-setup-source-grounding-final.exe`, SHA-256
`07213A8FCA0F9E7E6812126F53EA674E5466BBB28AD4BDBB1134ABAA0CA08BB8`.
Desktop **37/37**, Rust **56/56**, strict Clippy, frontend/Turbo,
version/notices/diff, and retrieval Hit@5 `1.0`, nDCG@5 `0.9959934`, negatives
`5/5` pass. Details are in
[`atlas-1.0-source-grounding-final-fix.md`](atlas-1.0-source-grounding-final-fix.md).

No native Atlas window is available to the connected controller. The candidate
therefore remains uninstalled/unobserved in rendered runtime QA, and the release
recommendation is **NO-GO** pending one final functional validation condition.
Unsigned Windows distribution remains accepted.

## Fabricated Source-Code Final Closure (2026-09-12)

The last observed source-grounding defect was not retrieval: the model could render
an invented fenced Rust excerpt after retrieving the correct `commands.rs` evidence.
Atlas now performs a deterministic post-generation fence check before model content
is emitted to the UI. A normal implementation/source fence must be an exact
contiguous substring of evidence actually supplied to that response, allowing only
line-ending and trailing-whitespace normalization. Otherwise the fence is removed;
prose and citations are retained. The guard never searches arbitrary workspace files.
Explicitly requested example/proposal/patch code remains allowed and labeled as an
example.

The exact `state.active_workspace_id` regression, valid source/pinned excerpts,
unsupplied-source rejection, source authority, Kubernetes no-evidence, fixture
exclusion, and index recovery all pass. Final gates: desktop **37/37**, Rust
**66/66**, strict Clippy, Vite/Turbo, version/notices/diff, Hybrid Hit@5 `1.0`,
nDCG@5 `0.9959934`, negatives `5/5`.

Final candidate: `release-candidates/Atlas_1.0.0_x64-setup-final.exe`, unsigned
x64 NSIS only, version 1.0.0, SHA-256
`FD73D54CEF9EE057B1F6C5E05D48E2E5C569A29B3963729C3BC10D008C584D3C`.

**Final recommendation: GO.** Atlas 1.0.0 is release-ready for the owner-approved
unsigned Windows x64 NSIS distribution. There are **0 functional blockers**. Two
SHOULD FIX items remain (trusted signing if adoption warrants it; broader
real-repository retrieval calibration), with four POST-1.0 items (SmartScreen/
trusted signing, Linux validation, macOS support/notarization, updater
infrastructure). No release operation was performed.

## Release Execution Incident and Correction Plan (2026-09-12)

The first release execution pushed commit
`b167078b85c4b1dd84fd65e33cc7278a89b32e09` and prematurely created annotated
tag `v1.0.0` at that commit, but did not create a GitHub Release, upload any
artifact, or deploy the website. The historical token-shaped value removed from
`website/README.md` was checked privately and returned an invalid/revoked result;
its historical exposure remains documented without rewriting history.

GitHub's fresh Linux quality runners rejected `THIRD_PARTY_NOTICES.md` because
the generator used locale-sensitive ordering. The correction replaces that order
with deterministic code-unit comparisons and adds a direct ordering regression
test. The checked-in notices resource is regenerated, so a new NSIS candidate is
required before publication even though application behavior is unchanged.

Website verification itself passed. The separate Vercel production job did not
start deployment because `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
`VERCEL_PROJECT_ID` were not configured as GitHub repository secrets. No
credential was committed or fabricated. After the corrected `main` commit passes
quality CI, the owner-approved remediation is to delete the unpublished premature
tag locally and remotely, recreate `v1.0.0` at the corrected commit, and verify
tag CI before publication.

## Website Deployment Model Addendum (2026-09-13)

The preceding Vercel-CLI GitHub Actions deployment incident is historical. The
deployment model was simplified after release: GitHub Actions performs website
verification only, while Vercel deploys directly from its Git integration for
`Rifaque/atlas` project `atlas-desktop`, branch `main`, with `website` as the
project root. Its independent install/build commands are `npm ci` and
`npm run build`; `website/vercel.json` pins Next.js rather than Vercel's generic
`Other` framework preset. The Actions workflow no longer reads Actions-side Vercel
deployment secrets; those secrets may be removed.
