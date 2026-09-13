![Atlas structural mark](assets/brand/atlas-mark.svg)

# Atlas

Atlas is a local-first workspace intelligence desktop app that indexes one codebase or document set, answers grounded questions with inspectable evidence, and makes every cloud transfer explicit and opt-in.

**Open → Index → Ask / Find → Inspect Evidence → Follow Up**

## Atlas 1.0.2

Atlas 1.0 officially ships for **Windows x64**.

- **Linux:** configured but unverified; not part of the 1.0 release.
- **macOS:** unsupported for 1.0.

The Windows installer is NSIS only. Atlas 1.0 is currently distributed as an
unsigned Windows installer, so Windows SmartScreen may show an Unknown Publisher
warning. Verify the published SHA-256 checksum before installing.

## Core capabilities

- Local workspace indexing with Ollama embeddings.
- Local Ollama generation, with optional OpenRouter generation.
- Ask and Find workflows backed by hybrid semantic and BM25 retrieval with
  reciprocal-rank fusion (RRF).
- Conservative no-evidence behavior: questions without enough workspace evidence
  can be rejected instead of answered from general model knowledge.
- Inspectable evidence, source previews, and pinned context.
- Workspace-scoped history and backend-authorized workspace access.
- Incremental indexing, bounded context assembly, and damaged generated-index
  detection/recovery.
- An explicit local/cloud privacy boundary.

Atlas 1.0 does not include agents, arbitrary shell execution, code-application
actions, Graph/Insights surfaces, personas, web search, vision attachments,
Overlay Chat, or multi-model routing.

## Install on Windows

1. Download `Atlas_1.0.2_x64-setup.exe` from the
   [Atlas 1.0.2 release](https://github.com/Rifaque/atlas/releases/tag/v1.0.2).
2. Verify SHA-256: `9F3E67551230A1840EBA7F8E69131169A25D942F9DD7EDAB574BE32E1F354975`.
3. Run the installer. SmartScreen may show an Unknown Publisher warning because
   this installer is unsigned.
4. Launch Atlas and ensure Ollama is running.
5. Open a workspace through the native folder picker.
6. Select an embedding model, such as `nomic-embed-text:latest`, and let Atlas
   index the workspace.
7. Use Ask or Find, inspect evidence, and follow up in the same workspace.

`install.ps1` and `install.sh` are developer source-bootstrap helpers, not Atlas
application installers.

## Requirements

- Windows 10 or 11 x64.
- [Ollama](https://ollama.com/) reachable for indexing and local generation.
- An embedding-capable Ollama model. `nomic-embed-text:latest` is the tested and
  recommended Atlas 1.0 embedding model.
- A separate compatible Ollama generation model for local Ask.

OpenRouter is optional and used only for explicitly enabled cloud generation.

## Privacy and security boundary

With default local Ollama-only use, workspace indexing, embeddings, generation,
and workspace evidence remain on the machine.

If OpenRouter is explicitly enabled, the relevant request content may be sent to
that provider: the user query, retrieved evidence, pinned context, relevant
history, and enabled Git/system context. Atlas treats cloud use as opt-in and
inspects the complete bounded outbound payload before sending it. OpenRouter
credentials are Rust-owned through the operating-system credential store.

Atlas authorizes workspace access in its backend. Requested files are canonicalized
and constrained to the authorized workspace root; arbitrary shell and unrestricted
filesystem IPC are not part of Atlas 1.0.

## Evidence and indexing

Atlas answers against indexed workspace evidence. Sources can be inspected in the
app, while no-evidence queries can be rejected rather than answered from model
knowledge. Displayed evidence represents material supplied or considered for an
answer, not guaranteed sentence-level attribution.

Atlas watches supported files and supports incremental indexing. Changing the
embedding model requires rebuilding the index. Atlas can detect a damaged generated
index and rebuild the required generated retrieval state without touching source
workspace files.

### Retrieval pipeline

`Semantic candidates + BM25 candidates → RRF → relevance classification → deduplication/diversity → bounded evidence selection`

## Current limitations

- The Windows installer is unsigned; SmartScreen/Unknown Publisher warnings are expected.
- Linux is configured but unverified for 1.0; macOS is unsupported.
- The updater is disabled.
- PDF and generic-file chunking is basic.
- Relevance calibration remains heuristic.
- Context budgeting is approximate rather than tokenizer-exact.
- Evidence is source-context material, not claim-level attribution.

## Developer setup

Requirements: Node.js `^20.19.0 || >=22.12.0`, pnpm 10.4.1, Rust 1.77.2+,
`protoc`, and the platform-specific Tauri prerequisites.

```bash
pnpm install --frozen-lockfile
pnpm version:check -- --expected 1.0.2
pnpm --filter desktop test
pnpm --filter desktop lint
pnpm --filter desktop build
pnpm --filter desktop tauri dev
```

For the Windows x64 NSIS package, run from `apps/desktop`:

```powershell
pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Atlas 1.0 does not use MSI as a release artifact. See [BUILD.md](BUILD.md) and
the [release checklist](docs/release/atlas-1.0-release-checklist.md) for release
process details.

## Documentation and license

- [Architecture](docs/architecture.md)
- [Product requirements](docs/prd.md)
- [Atlas 1.0 UX specification](docs/design/atlas-1.0-ux-spec.md)
- [Release-readiness report](docs/audits/atlas-1.0-release-readiness-report.md)
- [MIT License](LICENSE)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
