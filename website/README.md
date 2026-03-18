# Atlas Website

Premium launch site for Atlas, built as a standalone Next.js App Router app under `website/`.

## Local development

```bash
cd website
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and start

```bash
cd website
npm run build
npm run start
```

## Environment variables

Create `website/.env.local` when needed.

```bash
NEXT_PUBLIC_SITE_URL=https://your-site.example
GITHUB_OWNER=Rifaque
GITHUB_REPO=atlas
GITHUB_TOKEN=ghp_optional_token_for_higher_rate_limits
```

- `NEXT_PUBLIC_SITE_URL`: canonical URL for metadata and JSON-LD.
- `GITHUB_OWNER`: GitHub owner used by `/api/releases`.
- `GITHUB_REPO`: GitHub repo used by `/api/releases`.
- `GITHUB_TOKEN`: optional. Improves GitHub API rate limits in production.

## Release download mapping

`website/app/api/releases/route.ts` is the authoritative endpoint for release downloads.

- Windows: `.exe`, `.msi`, or filenames containing `win`
- macOS: `.dmg`, `.pkg`, or filenames containing `mac`/`darwin`
- Linux: `.AppImage`, `.deb`, `.rpm`, or filenames containing `linux`

The route normalizes the latest GitHub release into:

```json
{
  "tag_name": "v0.9.2",
  "published_at": "2026-03-06T13:17:17Z",
  "assets": [
    {
      "os": "windows",
      "name": "Atlas_0.9.2_x64-setup.exe",
      "url": "https://github.com/...",
      "size": 26127461,
      "sha256": "..."
    }
  ]
}
```

The UI prefers `.exe` over `.msi`, `.dmg` over `.pkg`, and `.AppImage` over package-manager formats. If no asset exists for the visitor&apos;s OS, the CTA falls back to the GitHub releases page.

## Assets and media

Current repo-sourced assets:

- `website/public/img/atlas-thumbnail.png`
- `website/public/brand/atlas-icon.png`

Current placeholders to replace with final marketing media:

- `website/public/img/placeholder-analysis.svg`
- `website/public/img/placeholder-review.svg`
- the hero mockup inside `website/app/components/Hero/index.tsx`

Recommended replacement targets:

- Hero media: 1600x1200 AVIF/WebP composite
- Carousel media: three 1600x1200 AVIF/WebP stills
- Optional product loop: `website/public/video/atlas-preview.webm` with MP4 fallback

To resync repo assets:

```bash
cd website
bash scripts/sync-assets.sh
```

## Accessibility and reduced motion

Useful checks:

```bash
cd website
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:a11y
```

Manual QA:

- Emulate `prefers-reduced-motion: reduce`
- Verify the hero no longer parallax-scrolls
- Verify the page flows directly from features into the screenshots gallery without a separate demo block
- Verify the screenshots modal closes with `Esc`
- Verify keyboard focus is visible across nav, carousel, modal, and CTAs
- Verify the mobile sticky CTA can be dismissed and stays dismissed for the session

## Deployment

### Vercel

1. Create a Vercel project that points at this repository.
2. Set the root directory to `website`.
3. Add the environment variables listed above.
4. Use `.github/workflows/website-ci.yml` for CI and token-based deploys.

Optional GitHub Action secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Contributing guidance

### Editing copy

- Keep headline copy concise and grounded in product reality.
- Avoid generic AI startup claims that are not reflected in the repo.

### Replacing screenshots

- Keep the 4:3 aspect ratio for carousel stills unless you also update the card and modal layout.
- Update alt text in `website/lib/content.ts`.

### Adding media

- Prefer AVIF or WebP for stills.
- Prefer muted WEBM with MP4 fallback for loops.

### Testing animations

- Check with and without `prefers-reduced-motion`.
- Confirm ScrollTrigger effects stay limited to opacity and translate transforms.

### Checking responsive behavior

- Test at 390px, 768px, 1024px, and 1440px widths.
- Confirm the sticky CTA appears only on small screens.

## Troubleshooting

- GitHub release fetch failures: verify `GITHUB_OWNER`, `GITHUB_REPO`, and token configuration.
- Missing downloads: check the latest release filenames against the OS heuristics.
- A11y check failures in CI: run `npm run test:a11y` locally and inspect the failing selector or contrast issue.
