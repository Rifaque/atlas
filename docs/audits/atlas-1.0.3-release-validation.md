# Atlas 1.0.3 release validation

## Scope

Atlas 1.0.3 is a Windows x64, unsigned NSIS retrieval-correctness patch. The
updater remains disabled. Branding, website design, and architecture are
unchanged from Atlas 1.0.2.

## Original failure

In the installed Atlas 1.0.2 app, with the `atlas` workspace indexed and ready,
Ask declined `authentication`, `auth`, and `Where is authentication handled?`,
and Find returned no results for them.

A read-only trace of the production retrieval code against the live index
established:

- The installed binary was 1.0.2 and contained the 1.0.1 direct fallback; the
  index was healthy (100 files, 1,209 chunks, `nomic-embed-text:latest`,
  `atlas_v2_768`, pipeline version 7).
- Atlas has no authentication implementation. The only indexed
  `authentication` matches were the Ask example prompt itself, a test mock, and
  one UX specification example. Ask declining was correct.
- Literal candidates survived BM25 and fusion but were erased by relevance
  classification. The 1.0.1 direct fallback could not recover text-only matches,
  and Find shared Ask's relevance gate, so Find also returned nothing.

## Defects fixed

### False positive in the 1.0.1 regression test

The 1.0.1 test asserted that `portfolio` was direct path evidence for
`\\?\C:\Projects\rifaque-portfolio\src\App.tsx`. The token occurred only in the
workspace root folder name, so the test passed for the wrong reason. It now
asserts that the root folder name does not match, while `src` and `app` from
the workspace-relative path do.

### Absolute-path direct fallback

`short_query_direct_matches` tokenized absolute candidate paths. Folder names
above or at the workspace root (`users`, `rifaq`, `documents`, `projects`,
`atlas`) matched every chunk. In 1.0.2, Ask `projects`, `rifaq kubernetes`, and
`users docker` activated the fallback and generated from unrelated chunks. The
fallback now matches only workspace-relative paths.

### Absolute-path BM25 scoring

BM25 searchable text, filename bonus, and path bonus also used absolute paths,
so a root token counted as a lexical term match. `kubernetes projects` reached
two distinct lexical matches and Weak relevance from one text term plus the
`Projects` folder. BM25 now scores workspace-relative paths.

### Substring symbol matching

Exact symbol matching used a raw substring test against the query. A test helper
named `doc` was an "exact structural match" for `users docker`, which admitted it
through Ask's direct fallback. A symbol now matches only when its normalized
tokens occur contiguously in the query or as one joined query token.

### Find and Ask fallback policy

- **Ask:** unchanged in intent. A `None` classification declines unless the
  bounded direct fallback (workspace-relative path token or whole-symbol match,
  at most two query tokens) applies. Text-only literal matches never bypass Ask
  grounding.
- **Find:** when relevance is `None`, Find returns at most five literal matches
  drawn only from lexical candidates. Semantic similarity alone cannot qualify.
  Matches rank by symbol/exact filename, filename, workspace-relative path, then
  chunk text, and remain explicitly unclassified (`relevance: none`,
  `literalFallback: true`).

The Ask example prompt and the UX specification example now use
`Where is workspace authorization enforced?`.

## Deliberately deferred

`classify_relevance` still judges only the top fused candidate. After the Find
split, no validated Ask query is blocked by this, so top-N classification is
deferred to a later release and documented at the classifier.

## Validation

- Desktop: 37 tests passed; lint, TypeScript, and Vite production build passed.
- Rust: `cargo fmt --check`, `cargo check --all-targets`, strict Clippy, and
  78 tests passed (68 existing plus 10 new retrieval regression tests).
- Retrieval evaluation: Hybrid Hit@5 1.0; nDCG@5 0.9959934; negative rejection
  5/5. Negative rejection now reflects the full Ask decision, including the
  direct fallback. Metrics are identical to Atlas 1.0.1 and 1.0.2.
- Website: lint, typecheck, 3 tests, accessibility smoke, and production build
  passed.
- Repository: version consistency, third-party-notices verification, and
  `git diff --check` passed. A current-worktree secret scan found only the
  deliberate `shield.rs` security-test literals.

### Runtime retrieval cases

Executed with the 1.0.3 production retrieval modules against the live `atlas`
workspace index:

| Mode | Query | Result |
|---|---|---|
| Ask | `projects` | Declined |
| Ask | `users docker` | Declined (1.0.2: direct fallback from an unrelated chunk) |
| Ask | `rifaq kubernetes` | Declined (1.0.2: direct fallback from unrelated chunks) |
| Ask | `authentication` | Declined |
| Ask | `Where is workspace authorization enforced?` | Strong; includes `is_workspace_authorized` and `workspace.rs` authorization code |
| Ask | `Explain Kubernetes pod scheduling and node affinity.` | Declined |
| Find | `authentication` | 3 literal text matches |
| Find | `auth` | 3 literal text matches |
| Find | `projects` | 5 genuine text matches; no path-prefix matches |
| Find | `components` | 5 workspace-relative path matches under `src/components` |
| Find | `require_workspace` | Strong, 10 results |
| Find | `workspace.rs` | Strong, 10 results |

### Installed-app smoke

The candidate was silently installed over Atlas 1.0.2 (`/S`). The first
install, run immediately after terminating the running 1.0.2 process, exited 0
but left the 1.0.2 `app.exe` in place while updating the uninstaller and
registry version. A second silent install with no Atlas process running replaced
it; `%LOCALAPPDATA%\Atlas\app.exe` then reported 1.0.3 and `NotSigned`. Close
Atlas fully before upgrading and confirm the executable version.

The installed application was driven through its WebView with the existing
`atlas` workspace and index:

- Settings shows `Atlas 1.0.3`; the index is ready with 100 files, 1,209 chunks,
  and `nomic-embed-text:latest`. No reindex was required.
- The Ask example list shows `Where is workspace authorization enforced?`.
- Ask declined `authentication`, `projects`, `users docker`,
  `rifaq kubernetes`, and the Kubernetes negative question with no sources.
- Ask `Where is workspace authorization enforced?` generated an answer with 8
  evidence sources, including `workspace.rs` lines 69–83 and
  `is_workspace_authorized` in `commands.rs` lines 105–110. The local model's
  prose favored the `outbound.rs` cloud-authorization source; retrieval was
  grounded, and answer quality remains model-dependent.
- The Evidence pane opened, listed all 8 sources, and previewed source content.
- Find returned 3 literal matches for `authentication` and `auth`, 5 genuine
  text matches for `projects`, 5 `src/components` path matches for
  `components`, and 10 results each for `require_workspace` and
  `workspace.rs`.

## Candidate and publication

- Installer: `release-candidates/Atlas_1.0.3_x64-setup.exe` (Windows x64 NSIS
  only, unsigned; no MSI)
- SHA-256: `16D953C943BF55F18D5A73F9C8C842B94203652CD2857E61F3883E51D50E7D23`
- Checksum manifest: `release-candidates/Atlas_1.0.3_SHA256SUMS.txt`
- Release commit: `71cb4dd` (`release: Atlas 1.0.3`). Branch CI failed on it:
  two new vectorstore tests converted Windows fixture paths through
  `evidence_from_store`, whose `Path::strip_prefix` cannot strip a Windows root
  on Linux. The test-only follow-up `63c5f04` asserts on the `quality_search`
  envelope instead; branch CI passed on it.
- Tag: annotated `v1.0.3` targets `63c5f04`; tag CI passed. Earlier tags were
  not modified.
- Build provenance: rebuilding from `63c5f04` produced an `app.exe` that differs
  from the candidate's only in 24 non-code bytes (PE link timestamp and debug
  directory timestamps/PDB GUID); all code and data sections are identical.
- GitHub Release: published as Atlas 1.0.3 (latest) at
  `https://github.com/Rifaque/atlas/releases/tag/v1.0.3`. GitHub's recorded
  installer digest and an independent public download both matched the checksum
  above, and the public checksum manifest is identical to the local one.
- Website: Vercel production deployment from `main` is live at
  `https://atlas.hubzero.in/`. It serves Atlas 1.0.3, CTAs to the v1.0.3
  release, the `Atlas_1.0.3_x64-setup.exe` filename, the matching checksum, the
  unchanged structural mark, and the unsigned Windows disclosure.
