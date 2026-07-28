The Framework's hexknot mark (#757, from brillout.github.io/brand-the-framework): six SVG strands with flat neutral fills at rest, switching to an animated six-hue gradient cycle while an agent is working (#875).

## TLDR

- Idle fills are `var(--logo-1..6)` (defined in `layouts/tailwind.css`): the shipped brand ramp runs neutral-950→500, which on a dark canvas would sink the leading strands, so the variables carry a lightened ramp in dark.
- `working` swaps each strand's fill to a per-strand `linearGradient` (`#hexknot-i`, userSpaceOnUse axis stored next to each path) whose two stops sit one hue apart and `<animate stop-color>` through the six brand HUES over 6s — same paths, only colour says the AI is at work.
- `logoLabel(working)` ("AI is working for you 🚀" / "AI isn't working for you 💤") feeds the `<title>` (hover prose) and the tab tooltip; `logoSpokenLabel` strips the emoji for `aria-label` — a screen reader saying "rocket" helps nobody (#948).

## Decisions

- Not `currentColor` with per-strand opacity (the obvious theme-aware-SVG route): a knot's over/under crossings are literal painted overlaps, so any strand below 100% opacity shows the strand beneath through the crossing.

## Facts

- Each stop's `values` cycle closes on its opening hue (7 entries, 6 distinct), so the 6s loop never jumps.
