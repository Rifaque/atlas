# Atlas Architecture

> [!IMPORTANT]
> **CRUCIAL FILE**: This is the authoritative Technical Architecture Document for Atlas. Do not delete or move.

## 1. Core Architecture: Unified Rust Crate
Atlas is built as a **single-binary, All-in-One native application**. It eliminates sidecar processes and local HTTP servers in favor of high-performance Inter-Process Communication (IPC).

### System Overview
- **Shell**: Tauri 2 (Rust)
- **Frontend**: React 18 + Vite (TypeScript)
- **Core Engine**: Rust Backend (LanceDB + Tree-Sitter + notify)
- **Communication**: Tauri IPC (`invoke/listen` events)

## 2. The RAG Pipeline
### 2.1 Indexing & Ingestion
- **Crawler**: Async file walker that respects `.gitignore` via the `ignore` crate.
- **Manifest**: `mtime`-based tracking ensures sub-second incremental indexing.
- **Parent-Child Chunking**: Indexes small (~512B) chunks for precision while injecting large (~2KB) parent windows for full LLM context.

### 2.2 Semantic Storage
- **LanceDB**: Local vector store using Apache Arrow for high-speed similarity search.
- **Metadata Handling**: Stores line ranges, file paths, and parent text for transparent citation.

### 2.3 Retrieval & Reasoning
- **HyDE**: Hypothetical Document Embedding generates a "best match" vector for query expansion.
- **Hybrid Search**: Fuses Cosine Similarity (Vector) and BM25 (Keyword) using **Reciprocal Rank Fusion (RRF)**.
- **GraphRAG**: Semantic relationship extraction for cross-file architectural understanding.

## 3. External Integrations
- **Ollama**: Primary local-first provider for LLM inference and embeddings (`nomic-embed-text`).
- **OpenRouter**: Optional cloud fallback for advanced reasoning models (GPT-4o, Claude).
- **Tavily/Serper**: Specialized agents for real-time web research integration.

## 4. Safety & Privacy Architecture
- **PII Shield**: Local regex/semantic scanner to prevent leaking secrets to cloud providers.
- **Local Priority**: All reasoning defaults to local models; external calls require explicit UI badges and user confirmation.
