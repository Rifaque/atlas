# Atlas 1.0 Product Requirements

> [!IMPORTANT]
> **CRUCIAL FILE**: Do not delete or move this document.

## Product definition

Atlas 1.0 is a local-first workspace intelligence desktop app that indexes one codebase or document set, answers grounded questions with inspectable evidence, and makes every cloud transfer explicit and opt-in.

The product loop is **Open Workspace → Index / Maintain Index → Ask or Find → Inspect Evidence → Follow Up**.

## Retained requirements

- One backend-authorized active workspace at a time, with a recent-workspace launcher.
- Failure-safe incremental indexing, watcher maintenance, factual health, and explicit refresh.
- Separate embedding and generation configuration.
- Local Ollama embeddings and generation through the configured host.
- Optional OpenRouter generation after workspace-scoped disclosure and authorization, an explicit cloud send action, and full-payload secret inspection on every request.
- Grounded Ask responses associated with the evidence supplied to generation.
- Find results with workspace identity, file path, 1-based line range, and snippet.
- File tree, bounded preview, citations, and pinned/manual context.
- Workspace-owned conversations, active session, and manual context with validated persistence migration.
- Basic read-only Git context when available.

## Explicit non-goals for 1.0

Atlas is not an agent platform or model playground. Architecture graphs, relationship visualization, analytics, personas, overlay chat, shell execution, diff application, web search, vision input, multi-model routing, multi-workspace retrieval, timeline navigation, and synthetic metrics are outside the 1.0 product.

## Trust requirements

Workspace file access is canonicalized and confined to a backend-authorized root. Cloud transfer is optional, visible to the caller, bounded, and scanned as one complete payload. Index state is only current when corresponding durable data exists. User-facing source lines are 1-based.
