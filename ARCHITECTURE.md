# Atlas — Technical Architecture Document

> **Version:** 1.0  
> **Date:** February 2026  
> **Stack:** Tauri 2 + React 18 + Fastify + LanceDB + Ollama / OpenRouter

---

## What is Atlas?

Atlas is a **local-first, privacy-preserving AI workspace assistant** built as a native desktop application. It allows developers to point it at any folder — a codebase, a collection of PDFs, a project directory — and then have a natural language conversation about the contents of those files. All processing happens on the user's own machine using locally-running language models (via Ollama), with an optional cloud fallback through OpenRouter. No file content ever leaves the machine unless the user explicitly opts into OpenRouter.

The core technology is **Retrieval-Augmented Generation (RAG)** — a technique that gives a language model access to a large external knowledge base (your files) that would otherwise be too large to fit into its context window.

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri Desktop Shell                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │               React 18 Frontend (Vite)             │  │
│  │   WorkspaceLayout • LandingScreen • SettingsModal  │  │
│  │   InlineFileViewer • FileTree • ChatUI             │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │ HTTP (localhost:47291)         │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │          Fastify Backend Sidecar (Node.js)         │  │
│  │   /api/chat  /api/index  /api/search  /api/sync    │  │
│  │   /api/index-progress  /api/file-content           │  │
│  └──────┬───────────────────────────┬─────────────────┘  │
│         │                           │                    │
│  ┌──────▼──────┐           ┌────────▼───────┐            │
│  │  LanceDB    │           │  Ollama / OR   │            │
│  │ (vector DB) │           │ (LLM & Embed)  │            │
│  └─────────────┘           └────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

The Fastify backend runs as a **sidecar process** spawned by the Tauri shell on startup. The frontend communicates with it over localhost HTTP. This separation means the backend can also be run standalone (`pnpm run dev`) for debugging.

---

## How RAG Works in Atlas — Full Technical Pipeline

### Phase 1: Indexing (Offline, one-time + incremental)

#### 1.1 File Crawling
The `crawlDirectory` function in `crawler.ts` walks the workspace folder recursively. It:
- Respects `.gitignore` rules using the `ignore` library
- Applies a hardcoded blocklist (`node_modules/`, `.git/`, `build/`, `target/`, `dist/`, `venv/`, etc.)
- Filters to a specific set of allowed extensions (`.java`, `.py`, `.ts`, `.pdf`, `.docx`, `.md`, etc.)
- Skips files larger than 10 MB (generated bundles, lock files)
- Parses each file to plaintext: standard UTF-8 for code/text, `pdf-parse` for PDFs, `mammoth` for Word documents

#### 1.2 Incremental Manifest
Before processing each file, the indexer checks a **manifest** file stored at `~/.atlas/manifests/<workspace-id>.json`. The manifest records the `mtime` (last modified timestamp in milliseconds) and chunk count for every indexed file. A file is skipped if its current `mtime` matches the manifest — only new or modified files are re-processed. This makes subsequent index runs near-instant for large codebases.

#### 1.3 Parent-Child Chunking
Files are not embedded as a whole. Instead, they go through a **parent-child chunking** strategy:

- **Child chunks** (~512 characters, ~50% overlap) — these are what actually get embedded and stored in the vector database. Smaller chunks produce more precise embedding vectors.
- **Parent chunks** (~2000 characters) — wider windows of surrounding context. These are stored as metadata alongside the child chunk but are NOT embedded.

When a child chunk is retrieved at query time, the *parent* text is what gets injected into the LLM's context window. This gives the LLM a much richer surrounding passage to reason about, while keeping the semantic search precise.

#### 1.4 Embedding with `nomic-embed-text`
Each child chunk text is sent to Ollama's `/api/embed` endpoint (with batching, falling back to `/api/embeddings` for older Ollama versions) using the `nomic-embed-text` model. This model is hardcoded separately from the chat model — it produces 768-dimensional dense vectors specifically optimised for semantic similarity search. Using the same model for both indexing and query-time embedding is critical for consistency.

The embedding model is **always `nomic-embed-text`** regardless of which chat model the user has selected.

#### 1.5 Vector Storage in ChromaDB
The resulting embedding vector, along with the child text and a metadata object, is stored in a ChromaDB collection named `atlas_workspace`. The metadata object contains:
- `filePath` — absolute path on disk
- `chunkIndex` — position of this chunk in the file
- `lineRangeStart` / `lineRangeEnd` — line numbers in the source file
- `parentText` — the full parent window text (up to 8000 chars)
- `parentLineRangeStart` / `parentLineRangeEnd`

---

### Phase 2: Query Time (Online, per chat message)

#### 2.1 HyDE — Hypothetical Document Embedding
Before searching the database, Atlas uses a technique called **HyDE (Hypothetical Document Embedding)**. Instead of embedding the raw user question (which might use different vocabulary than the source code/documents), it first asks the LLM to generate a *short hypothetical answer* (2–4 sentences or ~10 lines of code) to the question.

This hypothetical answer is then embedded with `nomic-embed-text`. The intuition is: a hypothetical answer "looks like" the kind of document that would answer this question, so it will have a higher cosine similarity to the actual relevant chunks than the raw question would.

HyDE only runs with Ollama (it's free). With OpenRouter, it's skipped to avoid spending API credits on the warmup call.

#### 2.2 Semantic Search (Cosine Similarity in ChromaDB)
The HyDE embedding (or raw query embedding if HyDE failed) is used to perform an approximate nearest-neighbour search in ChromaDB. Atlas over-samples by fetching **30 candidates** (instead of just the top 8 it needs) to give the re-ranking stage enough material to work with.

#### 2.3 Three-Stage Re-Ranking Pipeline
This is where Atlas goes significantly beyond basic RAG. The 30 semantic candidates are passed through a pure-TypeScript re-ranking pipeline with three stages:

**Stage 1 — BM25 Scoring**
BM25 (Best Match 25) is a classic Information Retrieval scoring function that operates purely on term frequency, not semantics. It tokenises both the query and each candidate document, computes the IDF (Inverse Document Frequency) of each query term across all candidates, and scores each document. Parameters: `k1=1.5`, `b=0.75` (standard values from the BM25 literature).

BM25 captures *exact keyword matches* that semantic search can miss — e.g., a specific error code, a function name, or a unique identifier.

**Stage 2 — Reciprocal Rank Fusion (RRF)**
RRF is a rank aggregation technique that fuses the cosine similarity rank list (from LanceDB) and the BM25 rank list into a single combined score. For each document, the RRF score is:

```
RRF(d) = 1/(k + cosine_rank(d)) + 1/(k + bm25_rank(d))
```

where `k=60` (the constant from the original 2009 Cormack et al. paper). This is more robust than simply averaging scores because it is resilient to outlier documents that rank extremely high on one signal but not the other.

**Stage 3 — Cross-Encoder Approximation**
A lightweight cross-encoder scores each document against the query considering:
- **(a) Exact term overlap** — fraction of query terms that appear in the document
- **(b) Character bigram overlap (Jaccard)** — fuzzy matching for morphological variants (e.g., "indexing" matching "indexed")
- **(c) Position bonus** — query terms appearing in the first 25% of the chunk score higher (relevant content is usually near the top of a function/section)
- **(d) Coverage penalty** — a 0.5× penalty is applied if fewer than half of the query terms appear at all

The final combined score is:
```
final_score = normalised_RRF * 0.6 + normalised_CrossEncoder * 0.4
```

The top 8 documents by this combined score are selected.

#### 2.4 Pinned (Manual) Context — Full File Injection
If the user has pinned specific files via the "Context" panel, those files **bypass the entire vector retrieval pipeline**. Atlas reads the raw file from disk (using the same `parseFile` function as the indexer, which handles PDFs, DOCX, and plaintext), takes up to 15,000 characters of content, and injects it directly as "PINNED CONTEXT" into the LLM prompt. This guarantees that the full content of critical files (like an admit card PDF, a config file, or a key source file) is always present in the answer.

#### 2.5 Conversation Memory with Rolling Window + Summarisation
Each chat message includes the last 6 turns of conversation history. If the history grows beyond 10 turns, the older turns are sent to the LLM for **summarisation** — the LLM produces a 3–5 sentence compact summary that replaces the old turns. This prevents context window overflow while preserving the thread of the conversation.

When passed as history, assistant messages have their `FOLLOW_UP_SUGGESTIONS:` blocks stripped so the LLM doesn't see its own meta-instructions as conversational content.

#### 2.6 Project Directory Map Injection
If a `folderPath` is provided, the backend generates a serialised file-tree (up to 3 levels deep) and appends it to the system prompt. This gives the LLM awareness of the overall project structure, helping it reason about file relationships even when specific files aren't retrieved.

#### 2.7 Prompt Construction and Streaming
The final prompt is assembled with:
```
SYSTEM: You are an expert programming assistant...
PINNED CONTEXT: [full file contents of pinned files]
CONTEXT: [parent-window text of top-8 retrieved chunks]
PROJECT MAP: [file tree]
CONVERSATION HISTORY: [last 6 turns or summary]
USER QUESTION: [the actual question]
FOLLOW_UP_SUGGESTIONS: [format instruction]
```

This prompt is sent to the LLM via a streaming HTTP request (Ollama `/api/generate` or OpenRouter `/v1/chat/completions`). The Fastify backend streams each token chunk to the React frontend as Server-Sent Events (SSE). The frontend renders chunks in real-time. Ollama is called with `num_ctx: 32768` (32K token context) to ensure large prompts including pinned files are never truncated.

#### 2.8 Follow-up Suggestion Extraction
After streaming completes, the backend scans the full accumulated response for the `FOLLOW_UP_SUGGESTIONS:` marker, parses the 3 numbered suggestions, and sends them as a separate SSE `suggestions` event. The frontend renders these as clickable buttons below the assistant message.

---

## Workspace & Storage

| Data | Storage Location | Format |
|---|---|---|
| Workspace metadata (name, path, model) | Browser `localStorage` (`atlas_workspaces`) | JSON |
| App settings (model, provider, API key, host) | Browser `localStorage` (`atlas_settings`) | JSON |
| Chat sessions & message history | Browser `localStorage` (`atlas_chats`) | JSON, up to 50 sessions |
| File index manifest (per workspace) | `~/.atlas/manifests/<id>.json` | JSON |
| Vector embeddings | LanceDB (embedded node module) | Apache Arrow / Lance format |

---

## Feature List

### Core RAG & Intelligence
| Feature | Description |
|---|---|
| **HyDE Query Expansion** | Before searching, asks the LLM to generate a hypothetical answer to the question; embeds that instead of the raw query for better retrieval precision. |
| **Parent-Child Chunking** | Indexes small child chunks for precise semantic search, but injects larger parent windows into the LLM prompt for richer context. |
| **BM25 Keyword Scoring** | Supplements semantic search with term-frequency/IDF-based keyword matching to catch exact identifier/symbol matches. |
| **Reciprocal Rank Fusion** | Fuses BM25 keyword ranks and cosine similarity ranks into a single robust ranking using the standard RRF formula. |
| **Cross-Encoder Re-ranking** | A third scoring pass using term overlap, bigram fuzzy matching, and position bonuses to produce the final top-8 context chunks. |
| **Pinned File Full Injection** | Pinned files bypass the vector DB entirely; their full raw content (up to 15K chars) is injected directly into the prompt. |
| **Conversation Memory** | Sends the last 6 turns verbatim; older turns are compressed into a summary by the LLM to prevent context overflow. |
| **Project Directory Map** | Injects a serialised file-tree into every prompt so the LLM has structural awareness of the whole project. |
| **Follow-up Suggestions** | The LLM generates 3 contextual follow-up questions at the end of every response; shown as clickable buttons in the UI. |
| **Streaming Responses** | LLM tokens are streamed from Ollama/OpenRouter → Fastify SSE → React UI in real-time for a responsive chat experience. |

### Indexing & File Support
| Feature | Description |
|---|---|
| **Multi-format Crawling** | Indexes `.java`, `.py`, `.ts`, `.js`, `.go`, `.rs`, `.cs`, `.cpp`, `.rb`, `.php`, `.kt`, `.scala`, `.swift`, and more. |
| **PDF & DOCX Parsing** | Extracts full text from PDF files (`pdf-parse`) and Word documents (`mammoth`) for indexing. |
| **Incremental Indexing** | Manifest tracks file `mtime`; only new or modified files are re-embedded on re-index runs — unchanged files are skipped. |
| **Background File Watcher** | Chokidar watches the workspace folder for file changes and triggers automatic incremental re-indexing with a 5-second debounce. |
| **`.gitignore` Respect** | The crawler reads and applies `.gitignore` rules alongside a built-in blocklist for `node_modules/`, `build/`, `dist/`, `target/`, etc. |
| **10 MB File Cap** | Files larger than 10 MB are skipped with a warning to avoid indexing minified bundles or binary blobs. |

### Multi-Model Support
| Feature | Description |
|---|---|
| **Ollama (Local)** | Runs fully offline using any model pulled via `ollama pull`; default LLM is `llama3.2:latest`. |
| **OpenRouter (Cloud)** | Optional cloud fallback supporting hundreds of models (GPT-4o, Claude, Gemini, Mistral, etc.) via an API key. |
| **Free OpenRouter Models** | Automatically fetches and categorises OpenRouter's free-tier models so users can experiment without cost. |
| **Per-message Model Override** | A model selector in the chat input lets users switch the model for a single query without changing global settings. |
| **Dedicated Embedding Model** | `nomic-embed-text` is always used for embeddings regardless of the selected chat model, ensuring dimensional consistency. |
| **32K Context Window** | Ollama is always called with `num_ctx: 32768` to prevent prompt truncation when large files are pinned. |

### Workspace & Navigation
| Feature | Description |
|---|---|
| **Multi-workspace Support** | Multiple workspaces can be saved, each with its own folder path and model; switch between them from the landing screen. |
| **File Tree Browser** | Sidebar shows the full indexed file tree; folders are collapsible; files can be pinned directly from the tree. |
| **Semantic Search** | A search bar performs live hybrid semantic + keyword search across the indexed workspace and shows file snippets. |
| **Inline File Viewer** | Clicking a source citation opens a full-screen code viewer with line number highlighting at the cited location. |
| **Open in System** | The file viewer has an "Open" button that launches the file in the OS default application via Tauri shell. |
| **Persistent Chat History** | All chat sessions are saved to `localStorage`; up to 50 sessions are retained across app restarts. |
| **Auto Chat Titles** | New chats are auto-titled from the first message's text (first 30 characters). |
| **New Chat on Open** | Each time you open a workspace, a new empty chat is started to avoid resuming stale sessions. |
| **Chat Branching** | Hovering over any user message reveals a branch button that forks the conversation from that point. |
| **Chat Export** | The full chat history can be exported as a Markdown file. |
| **Chat Renaming & Deletion** | Sessions can be renamed inline or deleted from the sidebar. |
| **Context Panel** | Shows all currently pinned files with an option to unpin; dynamically updates which files are injected into prompts. |
| **Sync / Re-index Button** | Triggers an incremental re-index of the workspace (file watcher detects all changes since last run). |
| **Ollama Status Indicator** | Real-time polling shows whether the local Ollama server is online or offline. |
| **Index Chunk Counter** | Displays the total number of embedded chunks currently stored in LanceDB for the workspace. |

### Settings
| Feature | Description |
|---|---|
| **Model Selection** | Choose from any locally installed Ollama model or any OpenRouter model. |
| **Custom Ollama Host** | Supports remote Ollama instances by setting a custom host URL (e.g., a LAN server). |
| **Custom System Prompt** | A user-defined system prompt is prepended to all queries to customise the assistant's persona or focus. |
| **OpenRouter API Key** | Securely stored in `localStorage`; never sent to any Atlas server; used only for direct OpenRouter API calls. |
| **Provider Toggle** | Switch between Ollama and OpenRouter modes globally from the settings modal. |

### Developer Experience
| Feature | Description |
|---|---|
| **Backend as Sidecar** | The Fastify backend runs as a Tauri sidecar process; startup failures are non-fatal so the backend can be run manually in a terminal for debugging. |
| **SSE Progress Streaming** | Indexing progress (processed files, total chunks) streams in real-time to the frontend via Server-Sent Events. |
| **Monorepo Structure** | Organised as a `pnpm` workspace with internal packages (`@atlas/chunking`, `@atlas/embeddings`, `@atlas/rag`, `@atlas/retrieval`) that can be developed and versioned independently. |

---

## Internal Package Architecture

```
packages/
├── chunking/     — Parent-child text chunking logic
├── embeddings/   — Ollama /api/embed wrapper with batching & fallback
├── rag/          — Prompt builder, HyDE, history summariser, Ollama & OpenRouter streaming
└── retrieval/    — LanceDB AtlasVectorStore + BM25/RRF/Cross-encoder re-ranker

apps/
├── backend/      — Fastify API server (indexing, chat, search, sync, file-tree)
│   ├── crawler.ts    — File walker, PDF/DOCX parser
│   ├── indexer.ts    — Incremental indexing job runner
│   ├── manifest.ts   — mtime-based incremental index manifest
│   ├── watcher.ts    — Chokidar background file watcher
│   └── index.ts      — Fastify route definitions
└── desktop/      — Tauri + React 18 application
    ├── src-tauri/    — Rust shell, sidecar management, capabilities
    └── src/
        ├── lib/          — API client, workspace/chat/settings persistence
        └── components/   — WorkspaceLayout, LandingScreen, SettingsModal,
                            FileTree, InlineFileViewer
```
