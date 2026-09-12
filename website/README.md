# Atlas website

The public Atlas site is a Next.js application for the Atlas 1.0 Windows x64
release. It describes the desktop product, its evidence-first workflow, local and
optional cloud privacy modes, supported platforms, and release limitations.

## Development

```bash
npm install
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
```

The production site reads public release metadata from GitHub. Do not place GitHub
personal access tokens, OpenRouter credentials, or any other secret in this
repository, website documentation, client-side configuration, or browser-delivered
environment variables. If authenticated automation is ever needed, configure its
secret only in the deployment provider’s protected secret store.

## Atlas 1.0 scope

Atlas 1.0 targets Windows x64 with an unsigned NSIS installer. Linux is unverified,
macOS is unsupported, and the updater remains disabled. The public download link is
prepared for GitHub Releases but is not a deployment instruction.
