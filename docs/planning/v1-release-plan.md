# Atlas V1 Release Plan: "The Personal Knowledge Frontier"

This document outlines the roadmap for the V1 release of Atlas. The focus shifts from a "dev-centric tool" to a "personal AI-first workspace" that is elegant, powerful, and accessible to non-developers.

## 1. UI/UX Overhaul: From Dashboard to Canvas

> [!IMPORTANT]
> The primary goal is to make Atlas feel like a premium, consumer-grade application while retaining its technical power.

- **Minimalist "Zen" Mode**: A default view that hides sidebars and focuses purely on the chat and current context.
- **Dynamic Workspaces**: Replace technical folder paths with beautiful workspace cards with custom icons and meaningful names.
- **Typography & Motion**: Transition to a more refined font (e.g., `Geist` or `Outfit`) and implement smooth, meaningful animations using `framer-motion`.
- **Global Search**: A "Spotlight-style" command palette (Ctrl+K) for navigating chats, workspaces, and files instantly.
- **Interactive Onboarding**: A guided walkthrough for new users to explain RAG, local models, and indexing.
- **Unified Architecture (Sidecar Elimination)**: Transition from a split "Frontend + Node sidecar" model to a single-binary Rust-Core model. Move all Fastify routes to Tauri IPC Commands, removing port conflicts and startup failures.
- **The Atlas Persona**: Redefine the assistant from a silent retrieval engine to a friendly, conversational partner. It should handle greetings (hi, hello) warmly and provide contextually rich, "chatty" responses.

## 2. Advanced Feature Set: Broadening Capabilities

- **Multimodal Intelligence**: Support for local vision models (e.g., `llama3.2-vision`) allowing users to chat about images, screenshots, and diagrams.
- **Local-First Web Research**: Optional integration for real-time web search (e.g., via Tavily or Serper).
- **One-Click Actions**:
  - **Summarize**: Instantly summarize a folder or document.
  - **Draft**: Turn a conversation into a structured Markdown or PDF document.
  - **Refactor**: Specialized code-to-code transformation modes.
- **Omni-Search**: Query across multiple indexed workspaces simultaneously.
- **Voice Mode**: Local "Whisper" integration for voice-to-text input and local TTS for spoken responses.
- **Timeline Intelligence**: Ask about project evolution. "What's new since yesterday?"
- **The "Secret Shield"**: Built-in PII and secret detection for cloud models (OpenRouter).
- **Agentic Workflows (The "Board of Advisors")**: Specialized personas (Architect, Writer, Security) with unique sub-prompts.

## 3. Efficiency & Performance: "Speed as a Feature"

- **Rust Retrieval Core**: Move heavy re-ranking and BM25 logic into the Tauri/Rust core to eliminate Node.js overhead and improve latency.
- **Optimized Embedding Pipeline**: Improved batching and concurrency during indexing.
- **Disk Footprint Reduction**: Implement vector compression and more aggressive cleanup of stale cache files.
- **Smart Caching**: Cache common queries and re-ranking results to provide near-instant responses for repeated questions.

## 4. Stability & Polish

- **Background Indexer Improvements**: More robust file watching with lower CPU usage.
- **Unified Settings**: A redesigned settings panel categorized by "General", "AI Model", "Workspace", and "Advanced".
- **Auto-Update System**: Fully functional, non-intrusive auto-updates for the app and the backend sidecar.

---

## Proposed Next Steps for Phase 1

1. **Design Mockups**: Create high-fidelity mockups of the new "Zen" UI.
2. **Core Refactor**: Begin moving retrieval logic to Rust.
3. **Multimodal Pilot**: Implement basic image drag-and-drop support.
