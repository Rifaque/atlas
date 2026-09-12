# Atlas 1.0 Phase 4 — Retrieval Quality Report

Date: 2026-09-06
Status: COMPLETE

## A. Baseline Pipeline

Phase 4 began at HEAD `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a` with the working tree already extensively modified by the user and Phases 1–3C. The complete `git status --short` snapshot was recorded before editing. It included the prior workflow, security, backend, frontend, documentation, deleted legacy-feature, and untracked Phase 1–3C files. No reset, clean, checkout, commit, or push was performed.

The actual Phase 3C retrieval pipeline was traced from code rather than inferred from historical documentation:

```text
Crawler
  -> tree-sitter declaration chunks for TypeScript/TSX/Rust/Python,
     otherwise 50-line windows with 10-line overlap
  -> batched Ollama embeddings
  -> dimension-specific LanceDB table
  -> semantic top 20
  + SQL ILIKE token matches
  -> exact matches prepended to semantic results
  -> independent evidence/manual/history/instruction/query truncation
  -> all retained candidates presented as response sources
```

Important baseline properties:

- TSX selected the TypeScript grammar rather than the TSX grammar.
- Markdown used generic line windows rather than section boundaries.
- The lexical path was unscored `ILIKE` OR matching. It did not implement BM25.
- The merge was list prepending, not score fusion or Reciprocal Rank Fusion.
- No calibrated relevance decision prevented an unrelated query from receiving the least-irrelevant vector results.
- Duplicate and overlapping chunks were not explicitly suppressed.
- Ask and Find used different retrieval paths; Find was semantic-only.
- Context categories were truncated independently rather than governed by one explicit total budget.
- Displayed sources were supplied candidates, but the UI wording could imply claim-level citation support.

> **Release-hardening note (2026-09-07):** The same evaluator was moved from
> `src/bin/retrieval_eval.rs` to `tests/retrieval_eval.rs` and is now invoked with
> `pnpm retrieval:eval`. This prevents Tauri from treating the harness as a shipped
> application binary. The corpus, algorithms, and thresholds described below did
> not change.

## B. Evaluation Corpus

The committed fixture is `apps/desktop/src-tauri/fixtures/retrieval/evaluation.json`. It contains 14 small synthetic chunks and 10 queries. No private repository content is included.

The corpus contains Rust, TypeScript, TSX, Python, Markdown, and configuration examples. It deliberately includes similarly named symbols, repeated ambiguous terms, cross-file flows, headings, comments, nested declarations, an irrelevant Kubernetes query, and a short follow-up query with explicit prior context.

Query categories:

1. exact symbol lookup;
2. conceptual workspace-authorization lookup;
3. keyword-heavy OpenRouter policy lookup;
4. cross-file indexing progress flow;
5. ambiguous cache terminology;
6. documentation-supported format lookup;
7. unrelated/negative query;
8. follow-up-like authorization query;
9. TSX component lookup;
10. document retention-policy lookup.

Each query identifies strongly relevant (`2`), supporting (`1`), and irrelevant (`0`) sources. Several queries allow multiple correct chunks; the negative query explicitly expects no evidence.

The harness is `apps/desktop/src-tauri/src/bin/retrieval_eval.rs`. It uses the real local `nomic-embed-text:latest` embedding boundary, evaluates four retrieval variants, computes metrics at execution time, and prints ranking diagnostics and stage timings. It does not hard-code scores as passing expectations.

## C. Metrics

- **Recall@K:** fraction of graded-relevant sources retrieved in the first K results.
- **Precision@5:** relevant sources divided by five selected positions.
- **MRR:** reciprocal rank of the first relevant result, averaged over positive queries.
- **nDCG@5:** rank-sensitive graded relevance using labels 0/1/2.
- **Hit@5:** fraction of positive queries with at least one relevant source in the first five.
- **Negative rejection:** fraction of negative queries for which no evidence is selected.
- **Duplicate rate@5:** exact or heavily overlapping selected chunks divided by selected chunks.
- **Distinct files@5:** mean file diversity in selected evidence.
- **Context characters@5:** mean selected source content size, for scale rather than token precision.

This is a deterministic regression/evolution suite, not a statistically comprehensive benchmark. In particular, negative rejection currently has one deliberately difficult negative query.

## D. Baseline Results

The `baseline` evaluator reproduces the prior semantic top-K plus unscored exact-term prepend behavior. It was run before the final retrieval path was selected and again in the final harness for a directly comparable result.

| Metric | Baseline |
|---|---:|
| Recall@1 | 0.5000 |
| Recall@3 | 0.8889 |
| Recall@5 | 0.8889 |
| Precision@5 | 0.2889 |
| MRR | 0.8492 |
| nDCG@5 | 0.8479 |
| Hit@5 | 0.8889 |
| Negative rejection | 0.0000 |
| Duplicate rate@5 | 0.0000 |
| Mean distinct files@5 | 5.0000 |
| Mean context characters@5 | 958.4 |

The most serious baseline failure was semantic-only grounding for unrelated queries: it always returned something.

## E. Lexical Retrieval

Atlas now performs local BM25 ranking in `retrieval_quality.rs` with `k1 = 1.2` and `b = 0.75`. Searchable text includes chunk content, path, filename, semantic name/symbol, and kind. Tokenization is Unicode-safe and identifier-aware:

- punctuation and path separators split tokens;
- `snake_case`, `kebab-case`, dotted paths, and Rust `::` become useful terms;
- camelCase and PascalCase boundaries produce component tokens;
- a small stop-word set limits generic natural-language dominance.

Restrained metadata boosts are applied after BM25: exact symbol/name `+4.0`, exact filename `+2.5`, and matching path segment `+0.35`. These signals improved exact developer lookups without creating user-facing fake confidence scores.

The lexical implementation intentionally reads the same committed LanceDB rows as semantic retrieval. It introduces no second durability domain, so Phase 1 replacement/delete/rename guarantees continue to cover both paths. The current trade-off is a bounded workspace-row scan (20,000 chunks) per query rather than a separately persisted inverted index.

## F. Semantic Retrieval

The embedding model and LanceDB vector representation were not changed. Query embeddings still use the workspace's configured Ollama host and embedding model. Semantic candidates increased from 20 to a bounded pool of 40 to give fusion enough recall. Workspace filtering remains mandatory.

Raw Lance distance is treated as an internal distance. For relevance calibration it is converted monotonically with `similarity = 1 / (1 + distance)`. Neither value is exposed as user-facing confidence.

Semantic-only results on the fixture:

| Metric | Semantic only |
|---|---:|
| Recall@1 / @3 / @5 | 0.7222 / 1.0000 / 1.0000 |
| Precision@5 | 0.3111 |
| MRR | 1.0000 |
| nDCG@5 | 0.9774 |
| Hit@5 | 1.0000 |
| Negative rejection | 0.0000 |

Semantic retrieval remained useful for conceptual recall but could not safely reject the negative query by itself.

## G. Hybrid Fusion

The final pipeline retrieves up to 40 semantic candidates and 40 BM25 candidates, identifies them by durable chunk ID, and combines independent ranks using Reciprocal Rank Fusion:

```text
rrf_score(d) = sum(1 / (60 + rank_i(d)))
```

`RRF_K` is 60. Raw semantic distance and BM25 score are not added or normalized against one another. A chunk returned by both paths is merged once. Stable tie-breakers keep results deterministic.

Final hybrid results:

| Metric | Hybrid RRF |
|---|---:|
| Recall@1 / @3 / @5 | 0.7222 / 1.0000 / 1.0000 |
| Precision@5 | 0.3111 |
| MRR | 1.0000 |
| nDCG@5 | 0.9960 |
| Hit@5 | 1.0000 |
| Negative rejection | 1.0000 |

Hybrid materially improved the Phase 3C baseline: Recall@5 and Hit@5 rose from 0.8889 to 1.0000, MRR from 0.8492 to 1.0000, nDCG@5 from 0.8479 to 0.9960, and negative rejection from 0% to 100%. It also slightly exceeded lexical-only nDCG and lexical Recall@3.

## H. Deduplication & Diversity

Final selection occurs after fusion:

- normalized identical content is retained once;
- same-file ranges with at least 60% overlap relative to the shorter range are suppressed;
- the first three selected chunks from a file are preferred;
- additional same-file chunks are deferred, then backfilled when required to satisfy the requested result count.

This is soft diversity, not a hard assertion that different files are always better. The fixture duplicate rate@5 is 0 for all four variants; the new overlap tests establish behavior on deliberately overlapping input.

## I. Relevance / No-Evidence Model

Relevance is an internal typed result: `Strong`, `Weak`, or `None`. It uses the best candidate's independently meaningful signals rather than RRF score alone:

- strong: lexical score at least 4.0; or lexical at least 1.0 with similarity at least 0.54; or similarity at least 0.72;
- weak: lexical at least 1.0 with similarity at least 0.56; or similarity at least 0.69;
- otherwise none.

Calibration used fixture positives/negative plus live repository queries. The real-workspace negative query exposed a misleading package-lock `node` match; the final joint-signal rules reject it without discarding the tested conceptual queries.

For `None`, Ask supplies no arbitrary retrieved chunks. If there is also no explicit pinned context, generation is not invoked and Atlas returns:

> I couldn't find enough evidence in this workspace. Try a more specific workspace term or use Find to inspect direct matches.

Find returns an honest zero-results state. If pinned context exists, it remains user-authoritative and can support generation even when retrieval returns none. The thresholds are deliberately conservative and remain a limited, corpus-calibrated heuristic rather than a universal probability.

## J. Context Budgeting

Atlas now has one explicit 25,000-character approximate request-context budget:

| Category | Total allowance | Per-source allowance |
|---|---:|---:|
| Retrieved evidence | 9,000 | 2,500 |
| Pinned/manual context | 6,000 | 2,000 |
| History | 4,000 | n/a |
| Instructions + optional Git | 2,000 | n/a |
| Current query | 4,000 | n/a |

The category constants are compile-time checked to equal the global total. Truncation operates on Unicode scalar boundaries and is deterministic. These are conservative character approximations, not claimed exact tokens. Prompt labels contribute a small bounded overhead.

Pinned files receive a meaningful reserved allocation but no single file can consume the entire request. Missing pinned files remain omitted with the established frontend unavailable state. Git stays supplementary within the instruction/Git allocation and cannot crowd out evidence.

Short follow-ups (four or fewer meaningful terms) add a bounded excerpt of the previous user turn to the retrieval query. The original user query remains the generation request.

## K. Citation Model

Only final, deduplicated evidence actually supplied to generation is attached to a response, capped at eight entries. Prompt evidence receives stable response-local IDs `[S1]`, `[S2]`, and so on with its display path and one-based line range. The model is instructed to cite only supplied IDs and never invent an ID.

Native QA showed that the configured local model did not reliably emit source IDs. Atlas therefore does not claim sentence-level attribution. The UI label is now **Evidence considered**, accurately meaning “supplied to generation,” while the exact source file/range remains inspectable. Invalid model-emitted IDs are not promoted into new evidence. Missing or stale files continue to use the existing graceful evidence-preview states.

## L. Chunking Changes

- `.tsx` now selects the tree-sitter TSX grammar; `.ts` continues to use the TypeScript grammar.
- Markdown and MDX are split by heading sections, preserving the heading as semantic chunk metadata.
- Markdown sections over 80 lines are subdivided with a 10-line overlap while retaining heading context.
- Rust, Python, TypeScript declaration chunking and the generic 50-line/10-overlap fallback were otherwise left intact.
- PDF extraction/chunking was not changed.

Tests cover TSX component extraction and heading-aware Markdown chunks. Parent-child retrieval was not added because this fixture did not justify its complexity.

## M. Index Schema / Migration

`INDEX_PIPELINE_VERSION` is now `4`, stored on each manifest entry. Missing legacy versions deserialize safely as old/incompatible. An entry is current only when its content hash, embedding configuration, and pipeline version all match.

Existing pre-Phase-4 indexes require one rebuild. Atlas reports `incompatible` / **Rebuild required** through the existing index-health and rebuild UX; Ask and Find refuse mixed-schema retrieval. A real prior index was detected as incompatible and rebuilt through the native Atlas UI during QA.

BM25 uses the same committed LanceDB rows and metadata, so modified, failed, retried, deleted, and renamed files do not create a separate semantic/lexical synchronization problem. An integration test verifies exact retrieval, negative rejection, deletion, replacement under a renamed path, and Windows canonical workspace filtering.

## N. Performance

Final fixture run using local `nomic-embed-text:latest`:

| Stage | Measurement |
|---|---:|
| Embed 14 corpus chunks | 3,194.4 ms total |
| Query embedding | 40.10 ms mean |
| In-memory semantic rank | 0.29 ms mean |
| BM25 lexical rank | 1.01 ms mean |
| RRF + selection | 0.14 ms mean |

These small-run timings are directional, not statistically rigorous p50/p95 benchmarks. The lexical path adds no persistent index files, so its disk cost is zero beyond existing chunk metadata. Its known cost is scanning up to 20,000 workspace chunks into memory per query. Native queries against the real test workspace remained interactively responsive; no typing, panel, or preview regression was observed. Larger-workspace profiling remains necessary.

## O. Evaluation Comparison

| Variant | R@1 | R@3 | R@5 | P@5 | MRR | nDCG@5 | Hit@5 | Negative rejection |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Phase 3C baseline | 0.5000 | 0.8889 | 0.8889 | 0.2889 | 0.8492 | 0.8479 | 0.8889 | 0.0000 |
| Semantic only | 0.7222 | 1.0000 | 1.0000 | 0.3111 | 1.0000 | 0.9774 | 1.0000 | 0.0000 |
| BM25 lexical only | 0.7222 | 0.9444 | 1.0000 | 0.3111 | 1.0000 | 0.9939 | 1.0000 | 1.0000 |
| Final hybrid RRF | 0.7222 | 1.0000 | 1.0000 | 0.3111 | 1.0000 | 0.9960 | 1.0000 | 1.0000 |

Hybrid was retained because it combines semantic Recall@3 with lexical negative rejection and produced the best nDCG@5. The complexity is small and independently tested.

## P. Real Workspace QA

Native Tauri QA used the already authorized **Janbros** repository through Atlas's legitimate Rust-owned authorization. No path authorization bypass was introduced.

Observed workflow:

- Atlas detected the old index and displayed the Phase 4 rebuild-required state.
- Rebuild completed through the actual indexing UI and returned to healthy state.
- Exact Find for `design language` ranked `docs/strategy/04_DESIGN_LANGUAGE.md` first.
- Conceptual Find for `archive and warehouse concept` ranked the relevant design-decision section first and the design-language section second.
- An unrelated Kubernetes scheduling query returned no Find passages.
- Ask about the archive/warehouse design produced a grounded repository-specific response with inspectable evidence.
- A follow-up remained grounded in the prior question context.
- The final unrelated Ask returned the deterministic insufficient-evidence response without invoking generation.

The configured local model did not consistently emit `[S#]` markers, which motivated the truthful **Evidence considered** terminology rather than a false claim-attribution UI.

## Q. Tests Added

Twelve Rust tests and one frontend test were added or extended for Phase 4 behavior. Coverage includes:

- identifier-aware and Unicode tokenization;
- BM25 exact symbol/path behavior;
- RRF ranking and duplicate merge;
- exact duplicate and overlapping-range suppression;
- relevance classification and negative rejection;
- Unicode-safe global and per-source budgeting;
- pinned-context bounding;
- short follow-up contextualization;
- TSX parsing;
- Markdown heading-section chunking;
- one-based citation/source ranges;
- durable vector retrieval update/delete/rename synchronization;
- Windows path normalization/workspace filtering;
- incompatible index-health rendering;
- truthful **Evidence considered** interaction.

Final test totals: 36 frontend tests and 38 Rust tests, 74 passing overall.

## R. Validation Results

| Command | Result |
|---|---|
| `pnpm test -- --run` (`apps/desktop`) | PASS — 8 files, 36 tests |
| `pnpm lint` (`apps/desktop`) | PASS |
| `pnpm build` (`apps/desktop`) | PASS — TypeScript + Vite |
| `cargo fmt --check` | PASS |
| `cargo check --all-targets` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test --all-targets` | PASS — 38 tests |
| `cargo run --bin retrieval_eval` | PASS — 10 queries, all variants reported |
| `pnpm install --frozen-lockfile` (root) | PASS |
| `pnpm build` (root Turbo) | PASS — 1/1 task |
| `git diff --check` | PASS; Git emitted only existing line-ending conversion warnings |
| Native Tauri indexed-workspace QA | PASS for rebuild, Ask, Find, evidence, follow-up, and rejection workflow |
| `pnpm tauri dev` final smoke launch | PASS — Vite ready, Rust app compiled, `target\\debug\\app.exe` launched; then intentionally stopped |

Final Vite output: 424.41 kB JavaScript (131.38 kB gzip) and 51.75 kB CSS (9.71 kB gzip). No Phase 4 UI dependency was added.

## S. Documentation Changes

- `README.md` now describes relevance-ranked BM25, RRF fusion, bounded context, and no-evidence behavior.
- `docs/architecture.md` documents the real Phase 4 pipeline, TSX/Markdown chunking, index version 4, relevance policy, and approximate budget.
- `docs/benchmarks.md` remains explicitly archived and points readers to this measured Phase 4 report.

No claims were added for HyDE, GraphRAG, cross-encoder reranking, cloud reranking, or parent-child retrieval.

## T. Remaining Retrieval Limitations

- The synthetic corpus is intentionally small and has only one negative query; broader language/domain calibration is needed.
- Relevance cutoffs are conservative heuristics, not calibrated probabilities, and may reject useful borderline evidence.
- BM25 currently scans at most 20,000 committed chunks per workspace query; very large repositories need measurement and may eventually justify a transactional embedded inverted index.
- The character budget is conservative but not model-specific token accounting.
- Short follow-up contextualization uses the previous user turn only; it is not a general conversational query rewriter.
- Local generation models may ignore `[S#]`; Atlas provides evidence-considered semantics, not guaranteed claim-level attribution.
- Tree-sitter chunking still favors declaration nodes and can produce imperfect nested boundaries. Generic text/PDF chunking remains basic.
- No large-corpus latency or memory benchmark was completed.

## U. Deferred Experiments

The following were evaluated conceptually but not added because the measured hybrid path already met the Phase 4 goal with less complexity:

- local cross-encoder or heuristic reranking;
- HyDE and LLM-based query expansion;
- parent-child retrieval;
- GraphRAG or relationship-based ranking;
- cloud reranking;
- model-specific tokenizer packages;
- a separate persistent Tantivy/SQLite lexical store.

Any future experiment should be admitted only after expanding the evaluation corpus and demonstrating a material gain over the recorded hybrid result.

## V. Files Changed

### Phase 4 files

Added:

- `apps/desktop/src-tauri/fixtures/retrieval/evaluation.json`
- `apps/desktop/src-tauri/src/bin/retrieval_eval.rs`
- `apps/desktop/src-tauri/src/retrieval_quality.rs`
- `docs/audits/atlas-phase-4-retrieval-quality-report.md`

Modified for Phase 4:

- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/manifest.rs`
- `apps/desktop/src-tauri/src/parser.rs`
- `apps/desktop/src-tauri/src/vectorstore.rs`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/components/AskView.tsx`
- `apps/desktop/src/components/LandingScreen.tsx`
- `apps/desktop/src/components/WorkspaceHeader.tsx`
- `apps/desktop/src/components/WorkspaceLayout.tsx`
- `apps/desktop/src/components/interaction.test.tsx`
- `README.md`
- `docs/architecture.md`
- `docs/benchmarks.md`

`Cargo.toml` received `default-run = "app"` so the added evaluation binary does not make normal `cargo run`/Tauri development ambiguous.

### Pre-existing dirty work preserved

All other baseline modifications, deletions, and untracked files remained untouched as user/Phase 1–3C work. These include existing GitHub workflow and ignore changes; the archived `agents.md`; Cargo lock/build/capability/provider/workspace/security modules; the Phase 2 feature deletions; the Phase 3 frontend shell, evidence, history, settings, styles, hooks and tests; root package/lock changes; prior audits/design documents; and current product documentation outside the three Phase 4 documentation files listed above.

No commit or push was performed. No Phase 5 work was started.

## W. 2026-09-07 Grounding Regression Addendum

Real clean-profile QA exposed a Kubernetes false positive that the compact
fixture missed. A single repeated `nodes` term in a real workspace produced a
high BM25 score, was classified strong, and caused a generic generated answer
with eight sources. The fixture then had only one negative and did not represent
that incidental-term collision.

The classifier now needs an exact structural match, or two distinct lexical
terms plus semantic agreement, for strong automatic grounding. Weak/none Ask
results neither generate nor display automatic evidence. The fixture now has
five plausible negatives (Kubernetes, React Native navigation, PostgreSQL
replication, AWS Lambda cold starts, Docker Swarm leader election); the live
post-fix evaluation passed Hybrid Hit@5 `1.0`, nDCG@5 `0.9959934`, and negative
rejection `1.0` (5/5), without positive-metric regression.

Fresh runtime indexes now omit `docs/audits/` and explicitly archival documents
but retain current architecture/PRD/design/release docs. Pipeline version 5
requires a normal rebuild so v4 historical rows cannot support a current-product
answer. See `atlas-1.0-grounding-regression-fix.md` for root cause, pin-context
handling, tests, and the pending installed-runtime observation.
