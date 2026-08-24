# Bug analysis: packages/framework/dashboard/components/Logo.test.tsx

## Business logic (high-level)

Pins the two-state contract from `Logo.test.SPEC.md`: idle = six `var(--logo-N)` fills and zero
`animate` elements; working = six `url(#hexknot-i)` fills, 6 gradients, 12 animations; every
animation's `values` has 7 entries, closes on its opener, and visits all six hues; and the label
pair (emoji prose vs. spoken form used as the accessible name).

Verification that the tests verify their claims:

- The fills assertions compare the *ordered* array of all path fills — a missing strand, wrong
  order, or a stray extra path fails. Falsifiable.
- The cycle test derives its three properties (length 7, closure, 6 distinct hues) for every
  `animate` node, which together prove the wrap-around `hue(i - 1)` math — the exact place an
  off-by-one would land.
- The label test asserts both prose strings exactly and that the working mark's accessible name
  is the spoken (emoji-free) form via `getByRole('img', { name })` — pinning that `aria-label`,
  not `<title>`, wins the accessible name.
- All synchronous rendering; `cleanup` in `afterEach`; no mocks needed (pure component). No
  async hazards.

Coverage note (not a bug): the idle accessible name ("AI isn't working for you") is only pinned
via `logoLabel(false)`'s string, not via a rendered idle `getByRole` query — a swapped ternary in
`logoSpokenLabel` for the false arm would still be caught by nothing rendering-side, but the
direct string assertions on `logoLabel` plus the shared wording make a silent regression
unlikely; recorded as a minor gap only.

## Functions (low-level)

- Test 1 (idle): fills + zero animations. Correct.
- Test 2 (working): fills + counts (6 gradients, 12 animations = 2 stops x 6). Correct.
- Test 3 (cycle closure): see above. Correct.
- Test 4 (labels): exact strings + accessible name. Correct.

## Bugs found

None found.
