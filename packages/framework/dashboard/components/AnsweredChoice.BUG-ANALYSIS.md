# Bug analysis: packages/framework/dashboard/components/AnsweredChoice.tsx

## Business logic (high-level)

An answered gate collapsed to one row, expandable to the full decision. Two consumers (the
questions hub via `meta`/`footer`, the transcript's resolved rows bare). Checked against
`AnsweredChoice.SPEC.md`:

- **Collapsed line** — tick, title (truncating), optional meta, Expand/Collapse control with
  `aria-expanded`; costs one row. ✓
- **Expanded** — every offered option listed; picked ones ticked (`✓`, full strength), the
  rest greyed; empty pick renders "Accepted none" (`picked.size === 0` after normalizing via
  `pickedIds`, which maps `''`/empty array to `[]` — so a defensive empty-string single pick
  also reads as none rather than ticking nothing silently... it renders "Accepted none",
  which is honest). `footer` under the list. ✓

Edge cases: `pick` as a single id not present in `options` (shouldn't happen — the daemon
resolves against offered ids) would render all-grey + no "Accepted none" line since
`picked.size === 1`; a defensive mismatch nobody produces, noted as reliance on the resolver.
Duplicate option ids would collide as React keys — the gate schema owns uniqueness. Local
`expanded` state per instance; the transcript renders one instance per resolved event keyed by
its position, so no cross-gate bleed. No effects/listeners.

The whole collapsed line is a single `<button>` with `meta` rendered inside it — the hub's
`meta` is text (session label), not interactive, and its interactive "Open session" link goes
in `footer` (outside the button), so no nested-interactive violation from this file's side;
a consumer putting a link in `meta` would create one, which the prop docs steer away from.

## Functions (low-level)

- **`AnsweredChoice({ choice, pick, meta, footer })` (L10)** — state: `expanded` (default
  collapsed — matches "collapsed to a single line"). `picked` recomputed per render from
  `pickedIds` (handles string vs readonly array; copies, never mutates). Rendering: options
  keyed by id; tick column fixed-width so labels align. Verdict: correct.

## Bugs found

None found.
