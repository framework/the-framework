# Bug analysis: packages/framework/dashboard/components/DisclosureToggle.test.tsx

## Business logic (high-level)

One test pinning the whole (controlled) contract: the label renders as the button's accessible
name, a click calls `onToggle` exactly once, and `aria-expanded` mirrors the `open` prop across a
rerender in both directions (false → true). That is the component's entire observable behavior
apart from the chevron-rotation class, which is styling and reasonably untested.

Mechanics: synchronous component, synchronous test; `afterEach(cleanup)`; controlled-prop flip
done via `rerender` (correct — the component holds no state to toggle by itself, so clicking
again and expecting a change would have been the wrong test).

## Functions (low-level)

### Test "renders its label and toggles on click…" (L8–25)

Every assertion falsifiable: name query fails if children stop rendering inside the button;
`aria-expanded` checks fail if the mirror breaks; `toHaveBeenCalledTimes(1)` fails on double-fire.
Correct.

## Bugs found

None found.
