# Atlas V1 Release - Actionable Todo List

This todo list breaks down the [V1 Release Plan](v1-release-plan.md) into concrete, actionable tasks.

## 🎨 UI/UX & Design (The "Elegance" Pillar)
- [ ] **Design Systems Refactor**
  - [ ] Move from strict "Glassmorphism" to a balanced "Modern Minimalist" design system.
  - [ ] Audit all components for accessibility (WCAG 2.1 compliance).
  - [ ] Implement a curated color palette (HSL-based) with elegant dark/light transitions.
- [ ] **Dynamic Personality & Intent Recognition**
  - [ ] Refactor System Prompt to be more friendly and conversational (The "Atlas Persona").
  - [ ] Implement a "Greeting Handler" to respond warmly to basic messages (hi, hello, etc.) without searching vector DB.
  - [ ] Add random "Assistant Tips" to messages to showcase features proactively.
- [ ] **Main Interace Evolution**
  - [ ] Design and implement "Zen Mode" (centered, distraction-free chat).
  - [ ] Create a "Command Center" (Ctrl+K) with fuzzy search for workspaces, files, and actions.
  - [ ] Refactor Workspace Cards with metadata previews and custom icons.
- [ ] **User Journey & Feedback**
  - [ ] Build an interactive "Welcome Walkthrough" for first-time users.
  - [ ] Standardize and beautify all empty states and loading skeletons.
  - [ ] Implement a unified "Omni-Search" overlay.

## 🚀 Efficiency & Performance (The "Speed" Pillar)
- [ ] **Unified Rust Core (Sidecar Elimination)**
  - [ ] Implement Rust-based `#[tauri::command]` handlers for all current Fastify routes (Chat, Index, Search, Files).
  - [ ] Port the Node.js file crawler and incremental manifest logic to Rust.
  - [ ] Integrate the `lancedb` Rust SDK directly into the Tauri core.
  - [ ] Refactor the Frontend API client (`lib/api.ts` or similar) to use `invoke()` instead of HTTP `fetch`.
  - [ ] Remove `apps/backend` sidecar entry from `tauri.conf.json`.
- [ ] **Retrieval & Indexing Optimization**
  - [ ] Implement concurrent embedding generation (worker pools).
  - [ ] Add query-time caching layer for embeddings of common phrases.
  - [ ] Switch to a more compact vector storage format in LanceDB.

## ✨ Advanced Features (The "Massive Update" Pillar)
- [ ] **Vision Support (Multimodal)**
  - [ ] Implement drag-and-drop for images in chat input.
  - [ ] Create specialized image processing pipeline (resize -> local vision model).
  - [ ] Support Citations for image-based knowledge.
- [ ] **Timeline Intelligence**
  - [ ] Use `mtime` and file history to implement a "What's New" query mode.
  - [ ] Implement a "History Explorer" UI to visualize project evolution over time.
- [ ] **The "Secret Shield"**
  - [ ] Implement a pre-request scanner for API keys and PII.
  - [ ] Add a "Sensitive Data Detected" warning UI with redact/mask options for cloud models.
- [ ] **Agentic Personas**
  - [ ] Create specialized system prompt templates for "Architect", "Writer", and "Auditor".
- [ ] **Web Intelligence**
  - [ ] Integrate local-first web search (search query -> scrape -> chunk -> RAG).
  - [ ] Add "Search the Web" toggle in the chat input.
- [ ] **Actionable Outputs**
  - [ ] "Convert to Doc": Export chat thread to formatted PDF/Word.
  - [ ] "One-Click Summary": Add a summary button to the File Tree and Workspace header.
  - [ ] "Contextual Refactor": A UI mode specifically for applying AI-suggested code changes.
- [ ] **Voice Interaction**
  - [ ] Local "Whisper" STT integration.
  - [ ] Basic local TTS for response playback.

## 🛠️ Infrastructure & Stability
- [ ] **Unified Settings 2.0**
  - [ ] Redesign settings into a searchable, categorized modal.
  - [ ] Add "Advanced AI" settings (temp, top_p, context window size per model).
- [ ] **Updater & Packaging**
  - [ ] Solidify the Tauri auto-updater for both app and backend bits.
  - [ ] Implement a "System Status" dashboard (Ollama version, Disk usage, CPU/GPU status).
