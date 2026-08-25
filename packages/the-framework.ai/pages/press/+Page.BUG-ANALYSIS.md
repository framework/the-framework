# Bug analysis: packages/the-framework.ai/pages/press/+Page.tsx

## Business logic (high-level)

The `/press` page — the press kit. Per `+Page.SPEC.md` it must cover four things, and the page renders exactly those four `Step` blocks in that order:

1. **Logo** — the *hexknot* described as six interlocking strands forming a hexagon, previewed on a dark **and** a light swatch (the point being that the mark works on either), offered as a download, plus a link to the brand playground for more variants.
2. **Name** — "The Framework" (capital T, capital F) and the package `framework` in a `CodeChip`.
3. **Banner** — `banner.jpg` shown and linked, described as 1200×630 (the Open Graph size), a screenshot of `/banner`, with a link to the regeneration instructions. Verified: `public/banner.jpg` exists and is genuinely 1200×630, `pages/banner/+Page.tsx` renders a 1200×630 box, and `pages/+Head.tsx`'s `og:image` points at the same file — the three agree.
4. **Brand assets** — the logo sources, palettes and generator in `brillout/brand-the-framework`, plus an invitation to ask on Discord.

Static page: no state, no effects, no user input, no async. It reuses `TopNav`/`Footer` and the `ui.tsx` tokens, and imports `../index/styles.css` itself (each page imports it, since the landing page's import does not apply to a prerendered sibling route).

Behavioral details checked:

- **Asset links under Vike Client Routing.** `vike-react` enables `clientRouting`, and Vike intercepts every same-origin `<a>` left-click that is not external/`download`/`data-vike="false"`. `/assets/logo.svg`, `/banner.jpg` and `/banner` all get intercepted, but Vike's router falls back to `redirectHard(url)` (`window.location.href = url`) for any URL that matches no page route — so the SVG and the JPG do open normally, just via one extra client-side hop. Not broken; worth knowing, because adding `download` would both fix the download semantics (below) and skip the interception entirely.
- **Reachability.** Nothing on the landing page links to `/press` with a normal click; the only in-site route is `TopNav`'s right-click handler, which is what `TopNav.SPEC.md` specifies. The page is prerendered and directly addressable, so this is intentional, not an orphan.
- **Duplication risk.** The Discord invite is hard-coded here (`https://discord.gg/qc8zvdzWNR`) instead of importing `DISCORD_URL` from `../index/ui`, which every other link on the site uses. Both currently hold the same value; if the invite is ever rotated, this one link silently keeps the dead invite. A DRY/robustness smell rather than a present defect — recorded, not reported.
- **The light swatch.** `Swatch bg="#ffffff"` shows the same `/assets/logo.svg` on white; the mark is a multi-stop gradient hexknot with no white fills, so it stays legible — which is exactly the claim the two swatches are there to prove.

## Functions (low-level)

- **`BRAND_REPO`** — the brand repository URL constant; used once. Correct.
- **`pStyle`** — shared paragraph style (`margin: 0` so the `Step`'s flex `gap` is the only rhythm; `textWrap: 'pretty'` for the ragged edge). Correct.
- **`Step({ kicker, children })`** — a `<section>` with a mono uppercase kicker and its content column. Note these sections have no `id`, so `section[id] { scroll-margin-top: 76px }` does not apply — nothing links into them, so that is fine. Verdict: correct.
- **`Swatch({ bg, label, border })`** — one preview tile: `flex: '1 1 200px'` so the two tiles sit side by side on desktop and wrap to full width below ~430px. The logo `<img>` is fixed at 72×82 (ratio 0.878 against the SVG's own 0.887 viewBox ratio); SVG's default `preserveAspectRatio="xMidYMid meet"` letterboxes rather than distorts, so the sub-1% difference is invisible. `alt="The Framework logo"` is repeated on both swatches, so a screen reader hears the logo twice with no indication of the dark/light distinction — the adjacent `label` text supplies it. Verdict: correct.
- **`Page()`** — the default export (Vike accepts a default export for `+Page`, matching `pages/index/+Page.tsx`). Renders `TopNav`, the `<main>` column with the four steps, and `Footer`. Edge cases: none — no props, no data, no conditionals. Verdict: correct, apart from the download semantics below.

## Bugs found

1. `L69`: **The "Download: logo.svg" link does not download — it opens the SVG in the tab.** The anchor has no `download` attribute, so a visitor who follows the link labelled *Download* gets the logo rendered as a page and has to right-click → "Save as" to actually obtain the file. `+Page.SPEC.md` says the logo is "offered as a download". Same for the banner links at L80 and L88 ("`banner.jpg` … shown and downloadable"). Severity: minor. Confidence: low (a plain link to an asset is a common idiom, and the file is still reachable). Fix: add `download` to those anchors (which, as a side effect, also stops Vike's client router from intercepting the click).
