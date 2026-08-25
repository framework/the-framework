# Bug analysis: packages/the-framework.ai/pages/index/Footer.tsx

## Business logic (high-level)

The site-wide footer, rendered by every page (`pages/index/+Page.tsx`, `pages/press/+Page.tsx`, `pages/go-to-dashboard/+Page.tsx`): brand mark plus name on the left, and the three outbound links — Discord, GitHub, npm — on the right, each with its inline logo from `icons.tsx`. That is exactly `Footer.SPEC.md`'s contract, and all three URLs come from `ui.tsx`, so the footer cannot drift from the TopNav's and the Cta's links.

Static, stateless, no effects. The layout invariants it deliberately encodes:

- `justifyContent: 'space-between'` (rather than `marginLeft: auto` on the link group) so that when the link group wraps to its own line it aligns left under the brand instead of hugging the right edge — the comment states the intent and the code implements it.
- `boxSizing: 'border-box'` with `maxWidth: 1120` and horizontal padding, so the footer's content column lines up with every section above it instead of being 1120+padding wide.
- The `@media (max-width: 480px)` rule in styles.css targets `.site-footer` (the className is present) and stacks/centers it with `!important`, which is required because `flex-direction`, `gap` and `padding` are inline styles here.
- The inner `<span>` holding the links is `display: flex; flex-wrap: wrap` with a `12px 20px` row/column gap, so on narrow screens the three links wrap rather than overflow.

All three anchors are same-tab links to external origins; Vike's client-router interception skips external URLs, so they navigate natively. `<img alt="">` on the logo is correct (the adjacent text "The Framework" carries the meaning), and the icons are `aria-hidden` inside links whose text labels them.

## Functions (low-level)

- **`linkStyle`** — shared inline style object for the three anchors: inline-flex, 7px gap, muted color. Reused by reference across all three links; no mutation anywhere, so sharing one object is safe. Note the muted `#859289` overrides the stylesheet's `a { color: #7fbbb3 }` (inline beats element selector), and `.footer-link:hover` in styles.css needs its `!important` for the same reason — it has it. Verdict: correct.
- **`Footer()`** — the only export, no props, no branches. Renders the brand span and the link span. Edge cases: none reachable. The three icon components get explicit sizes (Discord 15×12, GitHub 14, npm 14), all rendered as `currentColor` fills so they inherit the link color and its hover transition. Verdict: correct.

## Bugs found

None found.
