# Atlas Performance Benchmarks

> [!NOTE]
> Archived pre-refresh measurements. These values have not been revalidated against the reduced Atlas 1.0 product and must not be presented as current product metrics.
> Current Phase 4 retrieval evaluation and measured stage timings are recorded in `audits/atlas-phase-4-retrieval-quality-report.md`.

*Last Updated: March 2026 | Version: 0.10.0*

These benchmarks represent typical performance on a modern development machine (Windows 10, i7/Ryzen 7, 16GB RAM).

## ⚡ Speed & Latency

| Metric | Result | Notes |
|---|---|---|
| **Cold Startup** | ~1.2s | Time from click to interactive UI. |
| **Indexing Velocity** | ~48 files/sec | Using concurrent embedding batches. |
| **Search Latency** | ~180ms | Hybrid RRF search (Vector + BM25). |
| **UI Responsiveness** | <16ms | Consistent 60fps animations. |

## 🧠 Memory & Storage

| State | Memory Usage | Disk Footprint |
|---|---|---|
| **Idle (System Tray)** | ~12MB | Minimal background footprint. |
| **Active Chat** | ~45MB | Main UI + Rust IPC overhead. |
| **Indexing (Peak)** | ~160MB | LanceDB ingestion + Embedding buffers. |
| **Storage Density** | ~1.2MB / 1k chunks | Compressed vector storage. |

## 🧪 Methodology
- **Dataset**: `atlas` codebase itself (~300 files).
- **Inference**: Local Ollama instance (LLM: Llama 3.2, Embeddings: nomic-embed-text).
- **Storage**: LanceDB (v2 schema) on local NVMe SSD.
