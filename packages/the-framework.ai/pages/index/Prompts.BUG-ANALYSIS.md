# Bug analysis: packages/the-framework.ai/pages/index/Prompts.tsx

## Business logic (high-level)

The closing band of "How it works": a note saying everything is powered by open source state-of-the-art prompts (and you can bring your own), followed by chips for the four packs — Security audit, Code quality, Research, Product Management — plus a dashed "＋ Add yours" chip. `Prompts.SPEC.md` names exactly those four packs in that order and the "add your own" invitation; the code matches.

Design intent captured in the file's comment: it must *look* like the site's `Note` but cannot *be* the `Note` component, because `Note` renders a `<p>` and a `<p>` cannot contain the chip row's block-level `<div>` (the browser would close the paragraph early and the note's border/background would break). Instead it reuses `noteContainerStyle` and `noteLabelStyle` on a `<div>` — correct and deliberate, and it means a change to the note's look in `ui.tsx` still propagates here.

Static content, no state, no effects, no user input. The chip row is `flex-wrap: wrap` with a 10px gap, so five chips reflow rather than overflow on mobile.

## Functions (low-level)

- **`PACKS`** — four unique strings, used as content and as React `key`. Unique and static, so key-by-value is stable. Verdict: correct.
- **`chipStyle`** — shared chip geometry, spread *after* `cardStyle` for the four pack chips (so it adds radius/padding/typography without losing the card's background+border) and spread *before* the three overrides on the "Add yours" chip (`background: transparent`, dashed border, accent color) so those overrides win. Ordering is right in both places. Verdict: correct.
- **`Prompts()`** — the only export. Renders `<section id="prompts">` (nested inside `#how-it-works`; the id is not in `SectionNav.SECTIONS`, so it never competes for the scroll-spy highlight) containing the note div. The chips are non-interactive `<span>`s — the SPEC describes them as illustration, not links, so no missing handler. The "＋" is the fullwidth plus U+FF0B, which renders as a wide plus in the sans stack; intentional and consistent with the chip's optical weight. Edge cases: none — no data, no branches. Verdict: correct.

## Bugs found

None found.
