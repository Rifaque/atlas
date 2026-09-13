# Atlas 1.0.2 release validation

## Scope

Atlas 1.0.2 is a Windows x64, unsigned NSIS branding and polish-only patch. The
updater remains disabled. There are no retrieval, indexing, privacy, grounding,
or workspace-behavior changes from Atlas 1.0.1.

## Brand identity

The final structural Atlas A mark has two angled rails, a primary evidence beam,
and an inset lower source layer. Its authoritative SVG is
`assets/brand/atlas-mark.svg`; matching public copies are located at
`apps/desktop/public/atlas-mark.svg` and
`website/public/brand/atlas-mark.svg`.

The Tauri icon generator regenerated the Windows `.ico`, required PNGs, ICNS,
and Windows square-logo assets from the canonical vector source. The desktop
launcher/splash, website navigation, favicon/social metadata, and README now use
the same mark without the former boxed treatment.

## Validation

- Desktop: 37 tests passed; lint, TypeScript, and Vite production build passed.
- Rust: `cargo fmt --check`, `cargo check --all-targets`, strict Clippy, and
  68 tests passed.
- Website: lint, typecheck, 3 tests, accessibility smoke, and production build
  passed.
- Repository: version consistency, third-party-notices verification, current
  worktree secret scan, and `git diff --check` passed. The secret scan found
  only deliberate security-test literals.

## Candidate and publication

- Installer: `release-candidates/Atlas_1.0.2_x64-setup.exe`
- SHA-256: `9F3E67551230A1840EBA7F8E69131169A25D942F9DD7EDAB574BE32E1F354975`
- Checksum manifest: `release-candidates/Atlas_1.0.2_SHA256SUMS.txt`
- GitHub Release: published at
  `https://github.com/Rifaque/atlas/releases/tag/v1.0.2`. GitHub's recorded
  installer digest and an independent public download both matched the checksum
  above.
- Website: direct Vercel deployment from `main` is live at
  `https://atlas.hubzero.in/`. It serves the structural mark, Atlas 1.0.2
  release link and installer filename, matching checksum, and unsigned Windows
  disclosure.
