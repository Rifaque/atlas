# Starting Atlas (v0.2.0)

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 10 (`npm i -g pnpm`)
- **Rust** toolchain — [rustup.rs](https://rustup.rs)
- **protoc** (Protocol Buffers compiler) — required by `lancedb` crate
- **Ollama** running locally (`ollama serve`)

## Install Dependencies

```bash
pnpm install
```

## Development

### Full Tauri Desktop App (recommended)

```bash
cd apps/desktop
pnpm tauri dev
```

This starts the Vite dev server and the Tauri window. **No separate backend needed** — all backend logic runs inside the Rust core.

### Frontend Only (browser)

```bash
cd apps/desktop
pnpm dev
```

Opens at `http://localhost:47292`. Note: Tauri `invoke()` calls won't work outside the Tauri shell.

## Production Build

```bash
cd apps/desktop
pnpm tauri build
```

Outputs installers (`.msi`, `.nsis`, `.appimage`, `.deb`) to `apps/desktop/src-tauri/target/release/bundle/`.

## Architecture (v0.2.0)

Atlas is a **single-binary Tauri application**. The frontend communicates with the Rust core via Tauri IPC (`invoke()` / `listen()`). There is no separate backend process or HTTP server.

```
Frontend (React) ──invoke()──→ Rust Core (Tauri)
                                ├── crawler.rs     (file crawling, .gitignore)
                                ├── manifest.rs    (incremental indexing)
                                ├── embeddings.rs  (Ollama API)
                                ├── llm.rs         (streaming chat)
                                ├── vectorstore.rs (LanceDB)
                                └── commands.rs    (IPC handlers)
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+J` | Toggle Zen Mode |
| `Ctrl+,` | Settings |
| `Ctrl+F` | Focus Search |
| `Ctrl+/` | Focus Chat Input |
