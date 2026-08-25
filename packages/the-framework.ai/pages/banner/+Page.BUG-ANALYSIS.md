# Bug analysis: packages/the-framework.ai/pages/banner/+Page.tsx

## Business logic (high-level)

The `/banner` route: the social-preview image rendered as a real page at exactly 1200×630 — the
Open Graph size — so it can be screenshotted into `banner.jpg`, the file `pages/+Head.tsx`
advertises as `og:image`. It is deliberately chrome-less (no top nav, no footer), because its only
consumer is a screenshot.

Content, checked against `+Page.SPEC.md`: "Babysit AI" struck through, "Autonomous AI" as the
headline, the tagline "Make the important decisions, / let AI do the rest.", the three claims
(100% Open Source / Free / Local), and the logo with the wordmark "The Framework". All five are
present and spelled as the SPEC states.

The one hard constraint is **fixed-size, screenshot-stable layout**: nothing may reflow with the
viewport, and everything must stay legible at ~40% scale with ≥64px safe margins. The
implementation meets this by fixing `width: 1200; height: 630` with `boxSizing: 'border-box'` and
`padding: '64px 88px'` (so the safe area is 64px vertically and 88px horizontally, both ≥64),
`overflow: 'hidden'` so the two oversized glow circles cannot grow the page, and `whiteSpace:
'nowrap'` on the headline so the one line that must not wrap cannot.

Sizing sanity: the flex row is 1200 − 176 (padding) = 1024 usable, minus 48 gap, minus the 320px
logo column, leaves 656px for the text column. "Autonomous AI" at 79px/700 needs roughly 570px, so
the `nowrap` headline fits with margin. The badge row is three pills of ~150-190px plus two 13px
gaps — comfortably inside 656px.

There is no state, no effect, no data fetching, and no interactivity, so there is nothing to race
or leak. Being prerendered (site-wide `prerender: true`), the page is a static HTML file.

## Functions (low-level)

### `BADGES` (L4)

A `readonly` tuple array of `[label, color]`. Used only for the pill row; the label doubles as the
React `key`, and the three labels are distinct, so the keys are stable and unique. Correct.

### `Page()` (L13)

One component, all inline styles (deliberate — the banner must not depend on the shared stylesheet
beyond fonts, and `../index/styles.css` is imported only for the font-family cascade and reset).

- **Root container** — fixed box, flex row, `position: relative` so the two absolutely positioned
  glows anchor to it. `overflow: 'hidden'` is what makes the negative-offset glows safe. Correct.
- **Glow layers** (L31-52) — `aria-hidden`, purely decorative radial gradients. They are
  `position: absolute` inside a `relative` parent, so they do not participate in the flex layout.
  Correct.
- **Text column** (L54) — `position: 'relative'` so it paints above the glows without needing a
  z-index (later siblings win at equal stacking level). `flex: 1` takes the remaining width.
- **The strike-through** (L58-70) — an `aria-hidden` absolutely positioned bar over "Babysit AI",
  rather than `text-decoration: line-through`, so it can be coloured and rotated. Its parent has
  `position: relative` and `alignSelf: 'flex-start'`, so the `width: '106%'` is measured against the
  text's own width rather than the column's — which is why the bar tracks the words and not the
  container. Correct, and the reason `alignSelf` is there.
- **Tagline** (L76) — an explicit `<br />` rather than relying on wrapping, so the line break is
  identical in every screenshot. Correct for a fixed-size image.
- **Badge row** (L81-99) — each pill is a flex row with a coloured dot and the label; `borderRadius:
  999` is the standard pill idiom. Correct.
- **Brand lockup** (L103-125) — `flex: 'none'` so the logo column keeps its intrinsic 320px width
  and the text column absorbs the slack. `alt=""` is right: the logo is decorative here because the
  name "The Framework" is rendered as text directly beneath it (the press page, where the logo
  stands alone, correctly uses a real alt). `width: 320, height: 363` against the SVG's
  `viewBox="-289 -326 578 651.9"` (ratio 1:1.1279, i.e. 320×360.9) is ~2px taller than the
  intrinsic ratio, but SVG's default `preserveAspectRatio="xMidYMid meet"` letterboxes rather than
  stretches, so the mark is not distorted — it just centres in a 2px-taller box. The same rounding
  appears in every other logo usage on the site.

Verdict: correct.

## Bugs found

None found.
