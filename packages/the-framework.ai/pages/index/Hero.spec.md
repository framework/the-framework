Hero header (`#top`): struck-through "Babysit AI" over "Autonomous AI" headline, package-manager-aware try/install command boxes with copy-to-clipboard, badges, and intro blurbs — also exports the site-wide package-manager machinery.

## TLDR

- Exports `PMS` (npm/pnpm/bun/yarn → `try` + `install` command strings), `Pm`, `currentPm()`, `pickPm()` — reused by `/go-to-dashboard`.
- PM choice lives on `<html data-pm>`: set before first paint by the `+Head` script (no FOUC), flipped by `pickPm()` on tab click and mirrored to `localStorage.pm`; all four command variants are pre-rendered and CSS (`.pm-only-*` in `styles.css`) shows the matching one — no React state involved.
- Try box: PM tab row + one-shot command line (`# One-shot (no install)` comment); clicking copies the visible variant via `useCopy`, the corner `Badge` flips to "copied!".
- Install chip copies `<install cmd> && the-framework` — the pasted line installs and launches in one go.
- Also: three "100%" pill badges (Open Source / Free / Local), the `.strike` headline animation (CSS in `styles.css`), and a two-column "What is it? / Any software" intro grid.

## Decisions

- CSS-driven PM switching (not React state): the choice is known pre-paint and all variants exist in the prerendered HTML, avoiding FOUC/hydration mismatch on a static site.
