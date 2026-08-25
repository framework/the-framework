# Bug analysis: packages/the-framework.ai/pages/index/icons.tsx

## Business logic (high-level)

The three brand marks for the site's three outbound destinations, drawn as inline SVG so no logo is fetched from a third party (which is also what keeps the "100% Local"/no-tracking claim honest for the website itself) and so each mark inherits its link's color and hover transition through `fill="currentColor"`.

Each icon is `aria-hidden="true"`, which is correct at every call site: the TopNav, Footer and Cta anchors all carry visible text labels ("Discord", "GitHub", "npm", "Join us on Discord", "Star on GitHub"), so the marks are decorative. The only place a label is hidden is the ≤480px rule that hides `.nav-btn span` — an a11y wrinkle belonging to `TopNav`/`styles.css`, not to this file.

No state, no props beyond size, no DOM access — nothing to leak, race or go stale, and nothing that can fail at prerender time.

## Functions (low-level)

- **`DiscordIcon({ width, height })`** — takes width and height separately because Discord's mark is wide (viewBox `0 0 127 96`, ratio ≈ 1.32); every call site passes a matching pair (19×15, 16×13, 15×12 — all ≈1.27–1.33), so the mark is never visibly stretched. The path is the official Discord glyph. Verdict: correct.
- **`GitHubIcon({ size })`** — square `0 0 16 16` viewBox, one `size` prop used for both dimensions, so it cannot be distorted. Standard Octicon mark-github path. Verdict: correct.
- **`NpmIcon({ size })`** — square `0 0 16 16`; the path is the standard npm square-with-cutout logo, and it renders correctly with the default `nonzero` fill rule (the inner counters are drawn as reverse-wound sub-paths, which is why no `fillRule` is needed). Verdict: correct.

All three omit `focusable="false"`, which only matters for old IE — irrelevant for this build target.

## Bugs found

None found.
