Atlas – Technical Stack Document (All TypeScript)
1. Guiding Principles

One language across system

Local-first

Minimal dependencies

Reliable, widely adopted tools

Easy to package with desktop shell

Friendly for open-source contributors

2. Desktop Shell

Tauri (v2)

Purpose:

Application window

Native file dialogs

Secure filesystem access

Process management

Why:

Small binary size

Strong security model

Excellent performance

3. Frontend

React + TypeScript

Why:

Mature ecosystem

Excellent tooling

Strong typing

Easy componentization

Styling

Tailwind CSS

Why:

Fast iteration

Token-driven design

Glassmorphism friendly

UI Utilities

lucide-react → icons

clsx → class merging

4. Backend (Local API Server)

Node.js + TypeScript

Runtime:

Node 20 LTS

Framework:

Fastify

Why:

Very fast

Small footprint

Excellent TypeScript support

Clean plugin system

5. LLM Runtime

Ollama

Why:

Local models

Simple HTTP API

Offline

Actively maintained

Atlas assumes Ollama is installed locally.

6. Embeddings

Generated through:

Ollama Embeddings API

Why:

Same runtime as LLM

No extra services

Fully local

7. Vector Database

ChromaDB (local persistent mode)

Why:

JavaScript client

Persistent storage

Proven in RAG workflows

Simple API

Storage path:

~/.atlas/chroma/
8. File Parsing

Node libraries:

pdf-parse → PDFs

mammoth → DOCX

fs (Node built-in) → text & code

9. Chunking

Custom TypeScript module:

Recursive text splitting

Chunk size: ~800 tokens

Overlap: ~200 tokens

Why:

Full control

Simple logic

Tunable

10. Retrieval

Cosine similarity search using ChromaDB

Top-k = 6

11. RAG Pipeline

User query

Create query embedding

Retrieve top-k chunks

Construct prompt:

SYSTEM:
You answer strictly using provided context.

CONTEXT:
<chunks>

QUESTION:
<user question>

Send to Ollama

Stream response

12. Streaming

Server-Sent Events (SSE)

Why:

Simple

Works with Fastify

Easy to consume in React

13. Tauri ↔ Backend Communication

HTTP over localhost

Why:

Simple

Debuggable

Reliable

14. Local Storage Layout
~/.atlas/
 ├─ chroma/
 ├─ chats/
 ├─ settings.json
 └─ logs/

Chats stored as JSON.

15. State Management (Frontend)

Zustand

Why:

Lightweight

No boilerplate

Easy persistence

16. Build Tooling

Frontend:

Vite

Backend:

ts-node + tsup

Desktop:

Tauri CLI

17. Repo Structure
atlas/
 ├─ apps/
 │   ├─ desktop/
 │   └─ backend/
 ├─ packages/
 │   ├─ chunking/
 │   ├─ embeddings/
 │   ├─ retrieval/
 │   └─ rag/
 ├─ docs/
 └─ README.md
18. Logging

Backend:

pino

Frontend:

console + optional file logs

19. Error Handling

Backend:

Central error handler

Structured JSON responses

Frontend:

Toast notifications

20. Security

No telemetry

No outbound network calls by default

External API usage requires explicit user action

21. Development Environment

OS:

Windows / Linux

Required:

Node 20+

pnpm

Ollama

Rust (for Tauri)

22. Why This Stack Is Strong

One language everywhere

Minimal environment friction

Easy onboarding

Desktop + AI friendly

Recruiter-friendly