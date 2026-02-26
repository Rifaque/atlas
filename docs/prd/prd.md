Product Requirements Document (PRD)

Project Name: Atlas
Working Title: Atlas – Local AI Workspace for Exploring Code & Documentation

1. Purpose

Atlas is a local-first desktop application that allows users to index a folder (codebase or document collection) and interact with it using a chat-based AI interface powered by locally running models (via Ollama).

The goal is to help developers and technical users explore, understand, and search large sets of files using semantic retrieval and conversational queries, while preserving privacy and working fully offline.

Atlas is primarily a learning and architecture project and will be open source.

2. Goals

Build a local RAG (Retrieval-Augmented Generation) system end-to-end

Learn system architecture for embeddings, indexing, retrieval, and inference

Provide a useful tool for exploring codebases and documentation

Keep everything local by default

Produce a strong portfolio-quality project

3. Non-Goals

No cloud accounts or authentication

No team collaboration features

No real-time syncing

No mobile app

No monetization in initial versions

4. Target Users

Primary:

Developers

CS students

Researchers / technical users

Secondary:

Students with large collections of notes, PDFs, and docs

5. User Problems

Hard to understand unfamiliar codebases

Difficult to find where specific logic is implemented

Searching across many documents is slow and manual

Cloud AI tools require uploading private files

Need offline and privacy-preserving solutions

6. Core Use Cases

“Where is authentication handled in this codebase?”

“Summarize this repository”

“Which files reference payment processing?”

“Explain this error log folder”

“Find notes where X topic is discussed”

7. Product Principles

Local-first

Privacy-respecting

Transparent (show sources)

Simple UX

Narrow scope

8. High-Level Architecture

User selects folder

Files are scanned

Text is chunked

Embeddings are generated

Stored in local vector store

User asks question

Relevant chunks retrieved

Sent to local LLM via Ollama

Response returned with sources

9. Functional Requirements
9.1 Folder Indexing

Select parent directory

Recursively scan files

Supported file types (MVP):

.txt

.md

.pdf

.py, .js, .ts, .java, .c, .cpp

Display:

Number of files

Progress bar

Estimated time

9.2 Chunking

Break large files into chunks

Configurable chunk size

Store metadata:

File path

Chunk index

Line range

9.3 Embeddings

Default: local embedding model via Ollama

Optional: external API (OpenRouter)

Warning when external provider is used

9.4 Vector Storage

Store embeddings locally

Persistent between sessions

Fast similarity search

9.5 Chat Interface

Chat-style UI

Streaming responses

Ability to stop generation

Display sources used for answer

9.6 Document Search Panel

Keyword search

Semantic search

Show matching files

Open file button

9.7 Chat History

Store conversations locally

Collapsible sidebar

Rename / delete chats

9.8 Model Management

Detect if Ollama is installed

Allow user to choose model

Show model status

10. Non-Functional Requirements

Works offline

Runs on Windows and Linux (macOS optional later)

Indexing should not freeze UI

All data stored locally

Reasonable performance on mid-range machines

11. UX Layout (MVP)

Landing screen:

Select folder

Model selection

Index button

Main screen:

Left panel: Document Search

Center/Right: Chat Interface

Collapsible sidebar: Chat History

12. Privacy & Security

No file contents leave machine by default

External model usage requires explicit opt-in

Clear notice when external APIs are active

13. Tech Stack (Proposed)

Desktop:

Tauri (preferred) or Electron

Backend:

Python (FastAPI) or Node

Embeddings:

Ollama embedding models

Vector DB:

Chroma or SQLite + FAISS

Frontend:

React

14. MVP Scope

Folder indexing

Chunking

Local embeddings

Local vector store

Chat with sources

Document search

Ollama integration

Everything else is post-MVP.

15. Post-MVP Ideas (Optional)

File watcher for auto reindex

Code syntax highlighting

Export chat answers

Multi-workspace support

Plugin system

16. Success Criteria

Can index a 5k+ file codebase

Can answer questions grounded in files

No crashes during indexing

Clear sources shown

Clean repo and documentation