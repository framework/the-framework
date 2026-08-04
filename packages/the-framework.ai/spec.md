The marketing site for the-framework.ai — a fully prerendered Vike + React landing page, deployed to GitHub Pages.

## TLDR

- Private, never published; the root repo drives it via the `website*` scripts, and pushes touching this package deploy `dist/client` to the `gh-pages` branch.
- `pages/index/` is the landing page as a composition of section components (hero, "stop babysitting", how-it-works, features, CTA); `pages/index/ui.tsx` is the shared mini design system and the canonical Discord/GitHub/npm URLs.
- `HowItWorks` frames the product as exactly two building blocks — the enhanced system prompt and the queues — with prompt packs deliberately demoted to a "Note" band, not a third pillar.
- Other pages: `/press` (brand assets and naming rules), `/banner` (a fixed 1200×630 composition that exists only to be screenshotted into the OG image), and `/go-to-dashboard` (a URL-only landing page explaining the dashboard runs 100% locally — deliberately unlinked from the site until opening it from the web actually works).

## Facts

- The visitor's package-manager choice (npm/pnpm/bun/yarn) is global page state: persisted in `localStorage`, restored by a blocking pre-paint script in `+Head.tsx` (no flash of the wrong variant), and rendered via CSS `data-pm` selectors — shared across pages.
- `public/CNAME` and `.nojekyll` ship inside the build output, which is what lets the deploy workflow wipe the branch (`clean: true`) without losing them.
- The click-to-copy hook ignores multi-clicks and active text selections (double-click means "select", not "copy") and falls back to a hidden textarea where the clipboard API is unavailable.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
