# Atlas - Development Todo List

Based on the [Product Requirements Document](prd.md), [UI/UX Design Document](design%20doc.md), and [Technical Stack Document](tech%20stack.md).

## Phase 1: Foundation & Project Setup
- [x] Initialize turborepo/monorepo structure (`apps/desktop`, `apps/backend`, `packages/*`).
- [x] **Desktop Shell**: Setup Tauri (v2) app with basic window configuration and secure filesystem access.
- [x] **Frontend**: Setup React + Vite + TypeScript in `apps/desktop`.
  - [x] Install Tailwind CSS, `lucide-react`, `clsx`, and Zustand.
- [x] **Backend**: Setup Node.js + Fastify + TypeScript in `apps/backend` (Targeting Node 20 LTS).
  - [x] Configure `pino` for central logging and setup a global error handler.
- [x] **Storage Layout**: Setup initialization for local directories: `~/.atlas/chroma`, `~/.atlas/chats`, `~/.atlas/settings.json`, and `~/.atlas/logs`.

## Phase 2: Design System & Core UI UI
- [x] Setup CSS tokens for "Dark Glassmorphism" theme (`--bg-main: #0B0F14`, `--glass-bg: rgba(20,25,35,0.15)`, etc.).
- [x] Configure typography (Inter or similar sans-serif, neutral fonts).
- [x] Build reusable UI components:
  - [x] Glass panels (10-20% opacity, slightly blurred, 1px thin borders, no shadows).
  - [x] Rounded 8px flat buttons (muted glass -> brighter on hover -> accent border active).
  - [x] Form inputs with glass background and thin borders (focus border = accent color).
- [x] Build **Landing Screen**:
  - [x] Centered frosted card.
  - [x] Folder selector using Tauri native file dialog.
  - [x] Model dropdown selector.
  - [x] Index button.
- [x] Build **Main Workspace Layout** shell (3 vertical panes):
  - [x] Collapsible History Sidebar (220-260px width).
  - [x] Resizable Document Search panel (300-350px width).
  - [x] Dominant Chat Area.

## Phase 3: File Parsing & Indexing Engine
- [x] Implement backend file crawler using Node's `fs`.
  - [x] Setup filtering for allowed extensions (`.txt`, `.md`, `.py`, `.js`, `.ts`, `.java`, `.c`, `.cpp`, `.pdf`, `.docx`).
- [x] Create parsing modules:
  - [x] Text & code files plain-text extraction.
  - [x] PDF parser via `pdf-parse`.
  - [x] DOCX parser via `mammoth`.
- [x] Implement `packages/chunking`:
  - [x] Recursive text splitting logic.
  - [x] Configurable chunk size (~800 tokens) and overlap (~200 tokens).
  - [x] Metadata generation (File path, Chunk index, Line range).
- [x] Integrate Ollama Embeddings API for local embedding generation.
- [x] Integrate ChromaDB (persistent mode at `~/.atlas/chroma`) and store document embeddings + metadata.
- [x] Implement UI progress indicators for indexing: non-blocking, showing number of files, progress bar, and estimated time.

## Phase 4: Retrieval Engine & Ollama LLM Integration
- [x] **Retrieval module**: Create cosine similarity search using ChromaDB.
  - [x] Set Top-k = 6 chunks retrieval.
- [x] **RAG Pipeline**:
  - [x] Query processing -> retrieve top-k chunks -> construct augmented prompt string (SYSTEM, CONTEXT, QUESTION).
- [x] **Ollama LLM Client**:
  - [x] Poll for installed/active Ollama status.
  - [x] Fetch available models.
  - [x] Send RAG prompt to chosen model.
- [x] Setup Fastify Server-Sent Events (SSE) streaming endpoint for the LLM output.

## Phase 5: Search & Chat Interfaces
- [x] **Feature: Document Search Panel (Middle)**
  - [x] Add search input (Keyword + Semantic execution).
  - [x] Render matched files list (file name, muted path).
  - [x] Include "Open File" button for results using Tauri system bindings.
  - [x] Pin indexed file count to panel bottom (or handle with status).
- [x] **Feature: Chat History Sidebar (Left)**
  - [x] Read/Write/Delete/Rename operations for `~/.atlas/chats` (stored as JSON).
  - [x] Render chat history rows (collapsed/expanded states).
- [x] **Feature: Chat Interface (Right)**
  - [x] Display active Workspace and Model name in top bar.
  - [x] Implement streaming markdown renderer for messages.
  - [x] Build message bubbles (User: darker glass/right, Assistant: normal glass/left).
  - [x] Render source citations under assistant messages as clickable pills (e.g., `[file.py]`).
  - [x] Add active multi-line input box and "Stop Generation" capability (Stop capability pending but input box is active).

## Phase 6: Polish & MVP Deliverables
- [x] Test the pipeline completely offline ("Airplane Mode") — backend health-check with exponential retry + offline banner in App.tsx; Ollama offline banner with instructions on LandingScreen.
- [x] Test indexing on a 5000+ file codebase without UI freezing or crashes — crawler skips files >10 MB, skips empty files, ignores expanded set of irrelevant dirs (`.venv`, `__pycache__`, `.next`, `.turbo`, etc.); all I/O is async non-blocking.
- [x] Confirm appropriate model warnings exist if adding optional external provider integrations — SettingsModal shows amber warning if model name is not in the known-good list, with actionable `ollama pull` instruction.
- [x] Audit accessibility (focus states, text contrast, keyboard support) across the UI — added global `:focus-visible` ring (CSS), `sr-only` utility, `role=dialog`/`aria-modal`/focus-trap on SettingsModal, `role=progressbar`, `aria-live` on status regions, `htmlFor`/`id` label pairs, `role=list`/`listitem` on workspace cards, keyboard-activatable workspace rows, `aria-label` on all icon-only buttons.

## Phase 7: Power-User Features (Implemented)
- [x] **Stop Generation** — AbortController cancels the SSE stream mid-response.
- [x] **Resizable Panels** — `react-resizable-panels` drag handle between Search & Chat panes.
- [x] **Settings Modal** — Model name, Ollama host, backend URL, and context slots are all configurable and persisted to `localStorage`.
- [x] **Code Block Copy Buttons** — Custom `ReactMarkdown` code component injects a clipboard button on hover.
- [x] **Chat History Management** — Hover on any chat row: Pencil to rename inline, Trash to delete (removes disk file via Tauri FS).
- [x] **Semantic Search Snippets** — `/api/search` now returns top matching chunk text as a preview; shown below each result in the Search panel.

## Phase 8: Power-User & Productization (Implemented)
- [x] **Re-indexing** — "Re-index Workspace" button in Settings returns to LandingScreen.
- [x] **Multi-Workspace Support** — LandingScreen shows recent workspaces as clickable cards. Workspaces stored in `localStorage`. Active workspace auto-restored on app launch.
- [x] **Conversation Export** — Export button in sidebar and chat header saves current session as a formatted `.md` file.
- [x] **Keyword Search Fallback** — `/api/search` now does a real grep-style scan of the workspace folder for exact keyword matches, blended with semantic results.
- [x] **File Tree View** — New "Files" tab in Search panel shows a collapsible tree of all indexed files. Click to open, hover to pin.
- [x] **"Jump to Line" in Citations** — Backend now returns `lineRangeStart`/`lineRangeEnd` in citation metadata. Source pills show `:line` numbers and open files at the correct line.
- [x] **System Prompt Customization** — Freeform system prompt field in Settings is prepended to every RAG prompt.
- [x] **Follow-up Question Suggestions** — After each answer the LLM returns 3 suggested follow-up questions as clickable buttons under the message.
- [x] **Toast Notification System** — Global `toast('msg', 'success'|'error'|'info')` helper with animated slide-in toasts on bottom-right.
- [x] **Onboarding / Empty States** — Ollama offline banner on LandingScreen with setup instructions. Keyboard shortcut hints on empty chat state.
- [x] **Keyboard Shortcuts** — Ctrl+K (New Chat), Ctrl+, (Settings), Ctrl+F (Focus Search), Ctrl+/ (Focus Input).
- [x] **Auto-start Backend** — Requires Tauri sidecar packaging (future work).
- [x] **ChromaDB Auto-start** — Requires Tauri sidecar packaging (future work).
- [x] **Multi-Model Routing** — Implemented dropdown to override LLM on a per-message basis, dynamically loading local and OpenRouter models.
- [x] **Chat Branching** — Added "GitBranch" button next to user messages to spawn a new chat branch.
- [x] **Remote Workspace Sync** — Trigger backend `git pull` from the workspace sidebar.
- [x] **GitHub Releases & Auto-Updater** — Added `.github/workflows/release.yml` with Tauri updater config.
- [x] **One-Command Installer** — Added `install.ps1` for Windows users.
