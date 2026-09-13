# Atlas Website 1.0 Overhaul

Date: 2026-09-12
Working-tree baseline: `d3f8215c4c853a3f832c9cc3d4dd57a0850b332a` on `development`
Scope: public website and website documentation only. No desktop-product behavior, release artifact, or release state was changed.

## A. Previous Website Assessment

The previous site was an animated, dark, component-heavy landing page with dynamic release fetching, a screenshot carousel, and feature language from pre-1.0 Atlas. Its presentation did not reliably match the simplified 1.0 product loop or the current evidence-first desktop interface. It also carried obsolete components, dependencies, and release-platform assumptions that were not appropriate for the Windows-only 1.0 launch.

## B. Security Token Finding

`website/README.md` contained a tracked GitHub-token-shaped value. Its value is intentionally not recorded here. The value was not an obvious placeholder and matched a GitHub personal-access-token shape, so it is classified as **potentially compromised**.

The tracked occurrence was removed and replaced with explicit instruction never to store credentials in the repository. A full working-tree exact-value check found no remaining copy. Broader credential-pattern checks found only deliberate credential-detection test fixtures in desktop test/security code; no website credential was found.

Deletion from current content does not remove a potentially real credential from Git history. The owner should revoke/rotate it through GitHub before release execution resumes. History was not rewritten, and no secret value was printed.

## C. Final Information Architecture

The site is now a focused static public page:

1. Product hero and Windows download/GitHub actions.
2. `Open → Index → Ask / Find → Inspect Evidence` workflow.
3. Ask and Find explanation.
4. Evidence-first inspection and pinned-context explanation.
5. Compact retrieval pipeline.
6. Local and optional-cloud privacy boundary.
7. Workspace security boundary.
8. Windows release requirements and limitations.
9. Final GitHub Releases CTA with checksum.

## D. Visual Direction

The redesign uses a quiet workbench: paper and slate surfaces, restrained borders, a single cobalt evidence accent, compact monospace metadata, and strong editorial typography. It intentionally avoids neon, glass panels, AI-orb imagery, animation-heavy marketing, and a feature-grid dump. The hero uses a clearly labelled illustrative evidence-workbench map rather than pretending to show a current desktop screenshot.

## E. Sections Rebuilt

The root route, layout metadata, global styling, content constants, accessibility coverage, and website developer README were rebuilt for 1.0. The new page explicitly covers grounded Ask, Find, evidence inspection, pinned context, hybrid retrieval, conservative no-evidence behavior, local/Ollama use, optional OpenRouter use, workspace authorization, damaged-index recovery, Windows requirements, installer status, and limitations.

## F. Removed/Stale Content

Removed obsolete landing components, dynamic release API utilities, release-format helpers, screenshot carousel/thumbnail, placeholder images, Tailwind configuration, and unused landing dependencies. The site no longer promotes old UI/features such as personas, agents, graph/Insights surfaces, overlay chat, vision, web search, GraphRAG, HyDE, autonomous workflows, multi-workspace activity, or unsupported platform claims.

## G. README Alignment

`website/README.md` now documents the same 1.0 public product posture: Windows x64 NSIS distribution, local-first behavior, optional explicit cloud use, unsigned-installer disclosure, disabled updater, and a separate developer setup. The website product definition, privacy claims, platform position, model requirement, and limitations align with the root 1.0 documentation rather than describing historical product concepts.

## H. Privacy/Platform Copy

Local mode is accurately qualified: with Ollama, indexing, embeddings, generation, and workspace evidence remain local. Optional OpenRouter usage is explicitly opt-in and says that the query, retrieved evidence, pinned context, relevant history, and enabled Git/system context may be sent as applicable after bounded-payload inspection.

The website states Windows x64/NSIS as the 1.0 target; Linux is configured but unverified, macOS is unsupported, and the updater is disabled. It plainly discloses that the installer is unsigned and that SmartScreen/Unknown Publisher messaging may appear.

## I. Download/Release CTA Strategy

Download links use the GitHub `v1.0.0` release-tag strategy, with an optional `NEXT_PUBLIC_ATLAS_RELEASE_URL` override for the eventual canonical release URL. No local, localhost, or invented artifact path is present. The exact published-candidate SHA-256 is displayed beside the final CTA. The site was not deployed and no release was created.

## J. Responsive QA

The locally built site was inspected in a browser at 1440×900, 1280×800, 1024×768, and 390×844. Desktop and laptop preserve the two-column hero/evidence map; tablet retains readable metadata; mobile collapses navigation and stacks content without squeezing the illustrative workbench into an unreadable card. The temporary browser viewport override was reset after QA.

## K. Accessibility

The page uses a single H1 with ordered section headings, semantic links, lists, a definition list for evidence/release metadata, descriptive accessible labels, visible focus styling, sufficient neutral-surface contrast, and `prefers-reduced-motion` support. Automated axe coverage passes with zero violations.

## L. Performance

The route is statically prerendered and does not fetch release data at runtime. It has no carousel, motion runtime, client-side operating-system detection, or screenshot payload. Unused `gsap`, `lucide-react`, `clsx`, `server-only`, Tailwind, and Tailwind forms dependencies were removed. The built static JavaScript chunks total approximately 575 KB before HTTP compression, mostly framework/runtime output; no large public product imagery remains.

## M. Tests

`npm test` passes 3/3 website tests. The coverage confirms the Windows download action, 1.0/unsigned/Linux wording, evidence and local/cloud privacy explanation, absence of removed-feature marketing terms, and zero axe violations.

## N. Build Results

The following all passed in `website/`:

* `npm test` — 3/3 passed.
* `npm run lint` — passed.
* `npm run typecheck` — passed.
* `npm run build` — passed; Next.js statically prerendered `/`.
* `git diff --check` — passed.

## O. Remaining Website Issues

There are no website build, copy-accuracy, asset, accessibility, or download-link-structure blockers. The potentially real historic token was privately checked against GitHub before final release execution and returned an invalid/revoked response. Its current-worktree occurrence remains removed; the historical commit was not rewritten. `npm audit` reports two moderate development-dependency advisories; no automatic dependency upgrade was applied during this content/UI task.

## P. Files Changed

This website-only work updates the root page, styling, metadata, content constants, website package metadata/lockfile, test coverage, and website README; deletes obsolete site components/assets/utilities; and adds this audit report. It is separate from the pre-existing desktop, retrieval, release-candidate, audit, and cleanup work already present in the working tree.

No commit, push, tag, deployment, release, or publication was performed.

## Q. Subsequent Deployment Simplification (2026-09-13)

GitHub Actions now verifies the website only. The Actions workflow retains its
fresh `npm ci`, lint, typecheck, unit-test, production-build, and accessibility
smoke-test steps for website and workflow changes on pull requests and `main`.
The former Vercel CLI preview and production deployment jobs were removed.

Production deployment is handled directly by Vercel's Git integration for project
`atlas-desktop`: repository `Rifaque/atlas`, production branch `main`, and root
directory `website`. Its install and build commands are `npm ci` and `npm run build`;
the default Next.js output setting is used and the public site requires no deployment
environment variables. `website/vercel.json` pins the Next.js framework preset to
avoid the dashboard's generic `Other` routing behavior. Any Vercel preview
deployments are likewise Vercel-managed.

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are no longer used by
GitHub Actions and may be removed from GitHub Actions repository secrets. No secret
value was read, changed, or committed.

The first direct deployment exposed an incorrect dashboard framework preset of
`Other`, which produced a Vercel `404 NOT_FOUND` despite a successful build.
`website/vercel.json` now deterministically selects `nextjs`; the next direct
production deployment rendered normally. That live check also corrected the public
checksum display to the released installer value
`5B93DFE693D543E68ABBF53307F198EE25B84F581EB979781FECBA7D114388CD` and adds a
focused render assertion for it.
