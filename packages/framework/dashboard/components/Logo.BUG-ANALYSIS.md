# Bug analysis: packages/framework/dashboard/components/Logo.tsx

## Business logic (high-level)

The hexknot brand mark (#757) doubling as the "is any agent working" ambient signal (#875). Two
states over the same six paths: idle paints flat fills from theme tokens `--logo-1..6` (opaque by
design — the knot's crossings are painted overlaps, so sub-100% opacity would show the strand
beneath); working swaps each strand's fill for a `userSpaceOnUse` linear gradient whose two stops
animate through the six brand hues on a 6s loop, offset per strand so the sweep travels. The
label pair: `logoLabel` (with emoji, the hover/tooltip prose via `<title>`) and `logoSpokenLabel`
(emoji-free, the `aria-label`) — per the SPEC's "reading out 'rocket' helps nobody".

Edge cases checked:

- `hue()`'s double-modulo handles the negative `i - 1` offset at strand 0 (wraps to the last
  hue) — verified by the cycle test's closure property.
- `cycle(offset)` emits 7 values (6 hues + repeat of the first) so the SMIL loop closes on its
  opening hue — no jump at the loop seam. Correct.
- Gradient ids are fixed (`hexknot-0..5`): two *working* Logos mounted at once would duplicate
  ids and both resolve `url(#hexknot-i)` to the first document match. Recorded as a reliance,
  not a bug: the gradients are identical (same viewBox geometry, `userSpaceOnUse` coordinates in
  the shared coordinate system), so even the collision paints pixel-identically; and the
  dashboard renders one mark.
- The `<defs>` render only when `working`, so the idle mark carries zero animation machinery
  (test-pinned: 0 `animate` nodes idle, 12 working).
- `viewBox="-289 -326 578 651.9"` bounds the ±239/±273 path extents with margin. Fine.

## Functions (low-level)

- `HUES` / `STRANDS`: static data; each strand has a path and a gradient axis. Correct.
- `logoLabel(working)` / `logoSpokenLabel(working)`: pure string pairs, exported for the tab
  tooltip and tests. Correct.
- `hue(steps)`: wrap-safe indexing incl. negatives; non-null assert is sound (index provably in
  range). Correct.
- `cycle(offset)`: `HUES.map((_, step) => hue(offset + step)).concat(hue(offset)).join(';')` —
  the closed 7-stop cycle. Correct.
- `Logo({className, working})`: `role="img"` + `aria-label` + `<title>` — accessible name comes
  from aria-label (spoken form) while the title supplies the hover text; both state the current
  mode. Stop 0 starts at `hue(i)` and stop 1 at `hue(i - 1)` — one hue apart, matching the
  "sweep along the strand" comment. Fill switch idle/working per strand. Correct.

## Bugs found

None found.
