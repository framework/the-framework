# Bug analysis: packages/the-framework.ai/pages/index/Cta.tsx

## Business logic (high-level)

The landing page's closing screen, and the page's last of the site's three exits: the headline "Join our community of agentic developers" over two buttons — Discord (primary, filled accent green) and GitHub (secondary, outlined). Per `Cta.SPEC.md` that is the whole contract: primary = join Discord, secondary = star the repo. Both URLs come from `ui.tsx` (`DISCORD_URL`, `GITHUB_URL`), so the page has a single source of truth for its outbound destinations and cannot drift from the TopNav/Footer links.

Purely static: no state, no effects, no lifecycle, nothing that can go stale or leak. The only behavior worth checking is layout and the anchor semantics:

- The section is not in `SectionNav.SECTIONS` and carries no `id`, which is what the scroll-spy's "clear the highlight at the bottom of the page" rule depends on (`window.innerHeight + scrollY >= scrollHeight - 120`); the large bottom padding here (`clamp(104px, 16vw, 220px)`) plus the footer is what makes that 120px threshold land inside this screen rather than inside YourFramework. Consistent with `SectionNav.SPEC.md`'s "Nothing is highlighted on the closing screen".
- Both links are plain same-tab anchors to external origins. Vike's client-router click interception skips them (`isUrlExternal`), so they navigate natively. No `target="_blank"`, hence no `rel="noopener"` requirement.
- The button row is `flex-wrap: wrap` + centered, so on a narrow viewport the two buttons stack instead of overflowing; the headline uses `textWrap: 'pretty'` and the `h1,h2,h3 { text-wrap: balance }` rule from styles.css (the inline `text-wrap: pretty` wins over the stylesheet rule, as inline styles beat element selectors).
- The hover states live in styles.css (`.cta-primary:hover`, `.cta-secondary:hover`) with `!important`, needed because the base colors are inline styles.

## Functions (low-level)

- **`Cta()`** — the only export. Renders a centered `<section>`: the logo image (`alt=""`, correctly decorative since the heading carries the meaning), an `<h2>` with two `Emoji` components (`💪`, `🦾` — both present in `ui.tsx`'s `EMOJIS` map, and `public/assets/emoji-flex.svg` / `emoji-mech-arm.svg` both exist, so neither renders a broken image), and the two anchors. Inputs: none. Edge cases: none reachable — no props, no conditional branches, no user input. The two emoji sit adjacent with no separating space (`💪` then `🦾` on the next JSX line, which JSX joins without whitespace because the newline+indent between two elements is trimmed): deliberate, they read as one gesture pair. Verdict: correct.

## Bugs found

None found.
