# Architectural Convergence: Unified Rust Core

> **Status**: Proposed for V1 Release  
> **Target**: Elimination of Node.js Sidecar Processes

## 1. The Legacy Problem (v0.x)
In the initial development phases, Atlas used a **Sidecar Architecture**:
- **Frontend**: React (running in Tauri webview).
- **Backend**: Node.js / Fastify process spawned by Tauri.
- **Communication**: HTTP network calls over local ports (e.g., `47291`).

### Issues:
- **Fragility**: The backend process could crash independently, leaving the frontend "alive" but non-functional.
- **Port Conflicts**: Startup would fail if port 47291 was occupied.
- **OS Interference**: Windows/Mac firewalls occasionally blocked the internal HTTP traffic.
- **Complexity**: Packaging a separate Node.js executable into the Tauri bundle (sidecar) added significant build-time overhead.

---

## 2. The V1 Solution: Unified Rust Core
For the V1 release, Atlas is transitioning to an **All-in-One Native Architecture**. All backend logic is being ported from Node.js to the Tauri Rust core.

### The Shift:
| Feature | Legacy (v0.x) | Unified (V1) |
| :--- | :--- | :--- |
| **Language** | Node.js (TypeScript) | Rust |
| **Protocol** | HTTP / TCP | IPC (Inter-Process Communication) |
| **Calling Method** | `fetch('http://localhost:...')` | `invoke('tauri_command_name')` |
| **Lifecycle** | Two separate processes | Single unified process |
| **Reliability** | "Sidecar failed to start" | "If the window is open, it's running" |

---

## 3. Implementation Strategy

### 3.1 Porting the API
All Fastify routes are being replaced by Rust `#[tauri::command]` functions defined in `src-tauri/src/lib.rs`.

**Example Transformation:**
```rust
// In src-tauri/src/commands.rs
#[tauri::command]
pub async fn check_ollama_status() -> Result<String, String> {
    // Native Rust implementation of the health check
}
```

### 3.2 Native Library Integration
- **LanceDB**: Use the native Rust `lancedb` crate instead of the Node wrapper.
- **Parsing**: Use Rust-native crates for crawling and parsing (e.g., `ignore` for gitignore support, `walkdir` for crawling).

### 3.3 Streaming with IPC
Streaming responses (SSE replacement) will now use **Tauri Events**. The Rust core will emit events that the React frontend listens for using `listen()`.

---

## 4. Key Benefits
1. **Zero Port Dependency**: No more firewall issues or port conflicts.
2. **Speed**: IPC is significantly faster than local HTTP overhead.
3. **Memory Efficiency**: Eliminates the overhead of a second V8/Node.js instance.
4. **Reliability**: A single lifecycle means "partial failures" (dead backend) are architecturally impossible.
