# Atlas 1.0.1 release validation

## Scope

Atlas 1.0.1 is a Windows x64, unsigned NSIS patch release. The updater remains disabled.

## Short-query retrieval fix

The healthy `rifaque-portfolio` index (267 chunks in `atlas_v2_768`) produced semantic, BM25, and fused candidates for `portfolio` and `rifaque`, but the shared relevance classifier classified the one-token candidates as `None`. Ask and Find therefore appeared empty despite correct workspace canonicalization, manifest identity, vector rows, and query filtering.

The patch preserves the Strong/Weak/None classifier. When it returns `None`, Atlas may retain at most five candidates as `Weak` only for a one- or two-token query with an exact normalized token in a candidate path or an existing exact structural match. Semantic-only and text-only matches cannot activate this fallback. Ask receives bounded weak evidence; Find receives direct source-discovery results. Kubernetes and other unrelated queries remain rejected.

## Branding

The final structural Atlas A mark is authored at `assets/brand/atlas-mark.svg`, with public desktop and website copies. The Tauri icon generator regenerated Windows `.ico`, required PNGs, and Windows square-logo assets from that source. The launcher, splash, and website navigation now use the mark.

## Regression coverage

- `short_direct_workspace_terms_have_bounded_weak_fallback`
- `canonical_windows_workspace_id_scopes_semantic_and_find_retrieval`
- Existing pinned-source, source-grounding, fabricated-code, fixture-exclusion, index-recovery, and Kubernetes-negative tests.

## Validation results

- Rust unit and integration tests: 68 passed.
- Retrieval evaluation: Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5.
- Remaining frontend, website, packaging, release, and public-verification results will be recorded before publication.

## Final validation update

The short-query path now emits an explicit `directFallback` marker. This lets Ask
receive only the same bounded, path-backed fallback that Find exposes, while
ordinary Weak evidence remains declined. The fallback is limited to at most five
candidates and requires an exact normalized path token or exact structural match;
semantic-only and text-only matches cannot activate it.

- Desktop frontend: 37 tests passed; lint, TypeScript/Vite production build, and
  Turbo build passed.
- Website: lint, typecheck, 3 tests, accessibility smoke, and production build
  passed.
- Rust: `cargo fmt --check`, `cargo check --all-targets`, strict Clippy, and 68
  tests passed.
- Retrieval: Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection 5/5.
- Version and third-party-notices checks passed. The notices generator derives
  the current release version from the root manifest.
- A current-worktree secret scan found only deliberate, redacted security-test
  fixtures; no production credential was found.

## Candidate artifact

- Windows x64 NSIS only: `release-candidates/Atlas_1.0.1_x64-setup.exe`
- SHA-256: `2C1C4F511895624400F437B4117ED4D532244D06828E4F10875C8F8324BD18CC`
- Checksum manifest: `release-candidates/Atlas_1.0.1_SHA256SUMS.txt`
- Signing: intentionally unsigned; SmartScreen/Unknown Publisher is an accepted
  release condition.

## Focused adjacent-core audit

The release audit stayed within Open → Index → Ask/Find → Evidence → Follow Up.
No additional small release-blocking issue was found in the validated
authorization, index-recovery, evidence, pinned-source, history, no-evidence,
source-grounding, or fabricated-code guard paths. Broader work remains out of
scope for 1.0.1.
