# Atlas 1.0 Grounding Regression Fix

**Date:** 2026-09-07
**Target:** 1.0.0 / Windows x64 NSIS
**Status:** automated remediation complete; installed post-fix runtime observation pending

## A. Executive Summary

Clean-profile manual QA exposed a release-blocking grounding failure: an unrelated Kubernetes question received a generic answer with eight automatic sources. The narrow repair strengthens relevance calibration, prevents historical audit text from entering fresh runtime indexes, and makes user-pinned context primary and traceable. No model, reranker, web search, agent, feature, or UI redesign was added.

## B. Reproduction

Against `<repository-root>` (129 manifest files / 1,465 chunks), `How does Kubernetes schedule pods across nodes?` was `strong` and returned FileTree/audit/package-lock sources. The indexing follow-up returned current UX-spec rows mixed with Phase 1/2 and v0.9.2 audit rows that mention retired Graph/Insights. A pinned authorization file was stored by its correct path, but was anonymous and competed with eight automatic sources.

## C. Runtime vs Evaluation Divergence

Runtime and evaluator share BM25, RRF, overlap suppression, and relevance logic. The old 14-document fixture had one negative and could not emulate the real workspace's incidental `nodes` collision while runtime scans up to 20,000 committed Lance rows. Existing v4 index rows also retained historical audits until a rebuild.

## D. Kubernetes Failure Root Cause

The prior classifier marked any top BM25 score of at least 4.0 as `Strong`, even when the score came from one repeated generic term. RRF elevated that row and Ask generated whenever non-empty evidence existed. A repeated file-tree `nodes` token is not Kubernetes evidence.

## E. Relevance Classification Fix

Candidates now retain distinct lexical-match count and exact symbol/filename status. Strong requires an exact structural lookup with lexical support, or two distinct lexical terms corroborated by semantic similarity (at least 0.50). Weak also requires two distinct lexical terms. Single-term or semantic-only candidates are `None`; Ask then skips generation and returns the explicit insufficient-workspace-evidence response unless the user supplied a pin.

## F. Historical Documentation Handling

The crawler excludes `docs/audits/` and documents explicitly marked archived/pre-refresh/non-current. It retains current architecture, PRD, design, and release documents. Historical reports were neither changed nor deleted. Pipeline version 5 forces normal reindexing, whose stale-file cleanup removes old audit chunks from the manifest and LanceDB.

## G. Pinned Context Root Cause

The pin pipeline persisted the correct workspace/session file path and Rust re-authorized it through `authorized_file`. The prompt gave the selected file an anonymous leading excerpt alongside up to eight automatic sources, allowing irrelevant automatic security text to dominate the model's attention.

## H. Context Assembly Changes

Pinned context is now assembled as authorized `(canonical path, content)` pairs and labeled with the workspace-relative path. Pins keep their bounded 6,000-character allocation. With a pin, automatic evidence becomes explicitly secondary and is capped at two sources / 3,000 characters rather than eight / 9,000. The total bounded-context and authorization designs are unchanged.

## I. Evidence Semantics

Displayed `Evidence considered` is the same citation list supplied to generation. Strong results may create it; weak/none results create zero citations and no generation context. This is source-context evidence, not claim-level attribution.

## J. Regression Tests

- A generic repeated `nodes` candidate is `None`.
- The actual LanceDB `quality_search` route rejects a plausible Kubernetes/nodes collision.
- Direct symbol lookup, workspace isolation, replacement/delete/rename remain covered.
- Weak results create neither generation nor displayed Ask evidence.
- Pinned context contains the selected relative path/content and preserves pin-priority limits.
- Runtime crawling retains current release docs while excluding a historical Graph/Insights audit.

## K. Retrieval Metrics Before/After

The old gate had nine positives and one negative; it reported Hybrid Hit@5 `1.0`, nDCG@5 `0.9959933758`, and negative rejection `1.0`. The post-fix gate has nine positives and five negatives (Kubernetes, React Native navigation, PostgreSQL replication, AWS Lambda cold starts, Docker Swarm leader election): Hybrid Hit@5 `1.0`, Recall@5 `1.0`, MRR `1.0`, nDCG@5 `0.9959934`, and negative rejection `1.0` (5/5).

## L. Real Workspace QA

A temporary local diagnostic (removed before completion) verified post-fix production retrieval returns `relevance: none` and zero sources for Kubernetes against the existing clean-profile index. The old index still contains audit rows by design until the corrected v5 build performs a normal reindex. The rebuilt NSIS must be observed for all four requested runtime cases before closing the blocker.

## M. Performance Impact

Expanded evaluation timings: query embedding 25.49 ms mean, lexical ranking 0.82 ms, semantic ranking 0.27 ms, fusion/selection 0.11 ms. The fix adds no network request, persistent index, or model call.

## N. Remaining Retrieval Limitations

This is conservative relevance calibration, not claim-level verification. Pins are file-level (a bounded leading excerpt), not mutable chunk IDs. Broader real-workspace calibration remains post-1.0 work.

## O. Release Recommendation

**NO-GO pending installed post-fix runtime validation.** The unsigned Windows policy remains accepted and is not a blocker.

The rebuilt post-fix NSIS candidate is retained as
`release-candidates/Atlas_1.0.0_x64-setup-grounding-fix.exe`, SHA-256
`BAB02E4A00B5BDEE7AE4259D3F9CCCBB81AEEE69D77E079C8099F6264032B2EE`.
It is unsigned by the accepted 1.0 policy and installed successfully with exit
code 0; interactive runtime observation remains the only unresolved evidence.

## P. Files Changed

This task changes `retrieval_quality.rs`, `vectorstore.rs`, `commands.rs`, `crawler.rs`, `manifest.rs`, the retrieval fixture, this report, and release-report addenda. All unrelated modified, deleted, and untracked work was preserved; no reset, clean, commit, push, tag, upload, or publication occurred.

## R. 2026-09-12 Pinned-Authority and Fixture Addendum

Later native validation confirmed that Lance recovery and Kubernetes no-evidence
behavior are closed. It also found a narrower defect: a source-directed
`workspace.rs` pin could be influenced by an automatic `commands.rs` test chunk,
and the synthetic `fixtures/retrieval/evaluation.json` corpus could enter normal
evidence. The v7 repair is documented in
[`atlas-1.0-pinned-context-final-fix.md`](atlas-1.0-pinned-context-final-fix.md).
It makes source-directed pins primary, returns labeled pinned evidence, and
excludes only the internal evaluation corpus. Automated coverage passes; direct
native observation of the new NSIS candidate remains required.

## Q. 2026-09-12 Agent-Run Validation Attempt

The rebuilt installed app and local Ollama were running. Its isolated profile
had completed pipeline-v5 indexing at **116 files** and **1,202 chunks**. A
temporary read-only production `quality_search` diagnostic against that profile
was removed immediately after use. It found current authorization code,
current-only indexing sources, Kubernetes `none` with **zero** sources, and
current architecture/workspace/PRD sources for Find. No audit path appeared.

Desktop UI control was unavailable: `sky` had no trusted RPC service, while the
provided computer surface exposed no Atlas app/window and no callable app
binding. Rendered UI/LLM response, pin action, Evidence pane, and normal
close/relaunch therefore remain unobserved. The owner profile was restored
byte-for-byte; the QA profile is retained at
`%LOCALAPPDATA%\Temp\atlas-postfix-grounding-qa-20260912`.
