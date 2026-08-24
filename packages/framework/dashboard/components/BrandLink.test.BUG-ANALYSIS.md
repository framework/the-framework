# Bug analysis: packages/framework/dashboard/components/BrandLink.test.tsx

## Business logic (high-level)

Five synchronous tests, no mocks. Coverage matches `BrandLink.test.SPEC.md` exactly:

1. **Real link** — `href="/"` on the role=link element. ✓
2. **Plain click** — constructs a real cancelable `MouseEvent` and asserts *both* halves:
   `onNavigate` called once and `defaultPrevented === true`. Using a hand-built event (rather
   than `fireEvent.click`'s defaults) is what makes `defaultPrevented` observable — correct
   technique, and the assertion pair cannot pass if either half regresses. ✓
3. **Modified clicks** — loops all four modifier keys, each a fresh cancelable event, asserting
   `defaultPrevented === false` with the modifier name as the assertion message; then a
   `button: 1` middle click; finally `onNavigate` never called across all five. The loop +
   final aggregate makes each modifier individually diagnosable and the callback silence
   collectively pinned. ✓
4. **Responsive fold** — honestly scoped: the comment concedes jsdom cannot prove the visual
   hide, so it pins the `hidden` + `sm:inline` classes (regression guard) and that the SVG mark
   carries no such hiding. This is a class-token assertion by necessity, and it can fail (a
   tidy-up dropping the classes). ✓
5. **Working state** — asserts the Logo's fill switches between the animated gradient url and
   the static var across a rerender. Couples to `Logo`'s internal fill values — brittle against
   a Logo redesign but a true end-to-end pin that `working` actually reaches the mark; the
   coupling is the cheapest observable jsdom offers here. ✓

All synchronous; `cleanup` per test; the `brand()` helper re-queries per assertion so no stale
node references.

One latent fragility (not a bug): test 5's `container.querySelector('path')` assumes the first
`<path>` is the working-sensitive one — true of the current Logo; a reordered SVG would need
the selector updated, and the failure would be loud, not silent.

## Functions (low-level)

- **`brand()` (L7)** — role query by accessible name `/The Framework/`; stable because the
  wordmark is CSS-hidden, not removed, in jsdom. Correct.
- **Event construction** — `bubbles: true` so React's delegated listener sees the events;
  `cancelable: true` so `preventDefault` is honored. Both flags are load-bearing and present.
  Correct.

## Bugs found

None found.
