# Bug analysis: packages/framework/dashboard/lib/favicon.test.ts

## Business logic (high-level)

Pins the #875 behaviors that can regress silently: the hook *swaps* the shell-emitted link rather
than appending a second one (asserted by count === 1 after a flip — the assertion that would
catch a naive createElement-always implementation), it toggles back on rerender, it creates a
link when none exists, and the two href constants map to the two states.

Do the tests verify what they claim?

- Test 1 seeds the DOM with the shell's link (using the real IDLE_FAVICON constant, so the test
  tracks the constant), renders with `working: true`, asserts the href swapped *and* uniqueness,
  then rerenders to false and asserts the swap back. Sound and honest.
- Test 2 renders into an empty head and asserts creation + href. Sound.
- Test 3 pins `faviconHref`'s mapping. Sound.
- Hygiene: `afterEach` empties `document.head`, so the created link cannot leak into the next
  test. The `icon()` helper reads `getAttribute('href')` — the same accessor the source guards
  on, so the tests exercise the actual comparison semantics.

Gap (noted): the dont-rewrite-same-href guard (the animation-restart protection) is not directly
pinned — doing so would need an attribute-mutation spy; the guard is simple and the comment
documents its reason. Not a defect of the tests.

## Functions (low-level)

- `icon()` — query helper; returns undefined when absent so a missing link fails the `toBe`
  loudly. Correct.

## Bugs found

None found.
