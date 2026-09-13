# Atlas website

The public Atlas site is a Next.js application for the Atlas 1.0.2 Windows x64
release. It describes the desktop product, its evidence-first workflow, local and
optional cloud privacy modes, supported platforms, and release limitations.

## Development

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:a11y
```

## Deployment

Website deployment is handled directly by Vercel's Git integration: project
`atlas-desktop`, repository `Rifaque/atlas`, production branch `main`, and project
root `website`. Vercel installs with `npm ci` and builds with `npm run build`; leave
the Next.js output directory at its default. No environment variables are required
for the current public site. `vercel.json` pins the Next.js framework preset so the
project does not fall back to Vercel's generic `Other` routing behavior.

GitHub Actions performs verification only. It does not deploy the site and does
not need Actions-side Vercel deployment secrets; those secrets can be removed through
GitHub repository settings. Pull requests may receive preview deployments from
Vercel's Git integration when that Vercel setting is enabled.

The production site reads public release metadata from GitHub. Do not place GitHub
personal access tokens, OpenRouter credentials, or any other secret in this
repository, website documentation, client-side configuration, or browser-delivered
environment variables. If authenticated automation is ever needed, configure its
secret only in the deployment provider’s protected secret store.

## Atlas 1.0.2 scope

Atlas 1.0 targets Windows x64 with an unsigned NSIS installer. Linux is unverified,
macOS is unsupported, and the updater remains disabled. The public download link is
prepared for GitHub Releases but is not a deployment instruction.
