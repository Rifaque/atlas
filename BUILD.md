> [!IMPORTANT]
> **CRUCIAL FILE:** Do not delete or move this build reference.

# Atlas Build Guide

Atlas uses pnpm 10.4.1, Node.js 20.19+ or 22.12+, Rust 1.77.2+, and Protocol Buffers. Ollama is required for indexing, retrieval evaluation, and local runtime QA, but not for compilation.

## Verify a source checkout

```bash
pnpm install --frozen-lockfile
pnpm version:check
pnpm --filter desktop test
pnpm --filter desktop lint
pnpm --filter desktop build
```

From `apps/desktop/src-tauri`:

```bash
cargo fmt --check
cargo check --all-targets
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
```

The retrieval evaluation additionally requires a running Ollama instance with `nomic-embed-text:latest`:

```bash
pnpm retrieval:eval
```

## Development

```bash
pnpm --filter desktop tauri dev
```

## Windows release bundle

Install the Microsoft C++ build tools, WebView2 tooling supplied by Windows, WiX/NSIS prerequisites resolved by Tauri, and `protoc`. Then run:

The 1.0 distribution target is NSIS only. Atlas 1.0 is intentionally unsigned;
verify and publish the exact installer SHA-256 as documented in
`docs/release/windows-code-signing.md`:

```powershell
pnpm --filter desktop tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Do not build or publish MSI for Atlas 1.0. Windows SmartScreen or Unknown Publisher
warnings are expected for the unsigned NSIS installer.

## Linux release bundle

On Ubuntu 22.04 install:

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf protobuf-compiler
pnpm --filter desktop tauri build --target x86_64-unknown-linux-gnu --bundles 'appimage,deb'
```

Linux bundle commands are documented, but Linux is not emitted by the 1.0 release workflow and has not received native Atlas 1.0 runtime QA.

## macOS

Atlas 1.0 has no macOS CI packaging, signing, notarization, or native QA. Do not publish a macOS artifact until those requirements are implemented and verified.

## Output paths

Bundles are written below:

```text
apps/desktop/src-tauri/target/<target>/release/bundle/
```

Automatic updating remains disabled. Current Windows packages are unsigned; do not imply code signing or update verification until real signing material is configured outside the repository.
