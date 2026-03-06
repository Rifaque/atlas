# Atlas PRD (Product Requirements Document)

> [!IMPORTANT]
> **CRUCIAL FILE**: This is the authoritative Product Requirements Document for Atlas. Do not delete or move.

## 1. Vision & Purpose
Atlas is a **local-first, privacy-preserving desktop application** designed for developers and researchers to interact with their codebases and document collections using natural language. It leverages locally running Large Language Models (LLMs) to provide semantically accurate answers without the need for cloud data uploads.

### Core Goals
- **Local-First RAG**: Build a complete Retrieval-Augmented Generation pipeline that runs entirely on the user's machine.
- **Privacy & Security**: Ensure that proprietary code and sensitive data never leave the local environment unless explicitly opted into.
- **Structural Code Awareness**: Move beyond raw text search by using semantic parsing (Tree-Sitter) and knowledge graphs (GraphRAG).

## 2. Target Audience
- **Developers**: Exploring unfamiliar repositories or finding specific logic implementation.
- **Researchers & Students**: Searching through massive collections of technical PDFs and documentation.
- **Privacy-Conscious Organizations**: Analyzing sensitive internal data without cloud exposure.

## 3. Core Functional Requirements
### 3.1 Workspace Indexing
- **Native Crawling**: Asynchronous directory scanning with `.gitignore` support.
- **Multi-Format Support**: Code (`.ts`, `.py`, `.rs`, `.go`, etc.), Text (`.md`, `.txt`), and Documents (`.pdf`, `.docx`).
- **Incremental Indexing**: Track file modifications (`mtime`) to only re-index changed files.

### 3.2 Intelligent Retrieval
- **Hybrid Search**: Blending semantic vector search (LanceDB) with keyword-based BM25 scoring.
- **Re-Ranking Pipeline**: Multi-stage re-ranking (RRF) to ensure the most relevant context reaches the LLM.
- **GraphRAG**: Contextual awareness through entity and relationship extraction.

### 3.3 Advanced Chat & Interaction
- **Streaming Responses**: Real-time token delivery for a responsive UI.
- **Pinned Context**: Ability to inject full file contents directly into the prompt.
- **Agentic Actions**: The ability for Atlas to propose and apply code diffs or execute terminal commands.

## 4. User Problems Solved
- **Onboarding Friction**: Drastically reduces the time to understand a new codebase.
- **Information Overshoot**: Finds the exact file and line number where logic resides, bypassing traditional "grep" limitations.
- **Privacy Paranoia**: Operates in air-gapped or confidential environments where cloud AI is prohibited.

## 5. Success Criteria
- **Scalability**: Successfully indexes and searches codebases with 5,000+ files.
- **Trust**: Answers are grounded in the provided context with clear source citations.
- **Efficiency**: Near-instant incremental updates and low memory footprint during background operations.
