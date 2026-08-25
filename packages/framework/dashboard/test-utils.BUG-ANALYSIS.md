# Bug analysis: packages/framework/dashboard/test-utils.ts

## Business logic (high-level)

Two helpers for testing the custom (Base UI) tooltips (#1149): `hoverTooltip` fires the
mouseenter+mousemove pair and waits for `role=tooltip`; `unhoverTooltip` fires mouseleave.

The interesting design point is re-firing the hover pair inside `waitFor`'s retry callback
(#1398): a pair dispatched before the trigger's listeners attach opens nothing, and a
single-shot fire followed by `findByRole` would then wait out its whole timeout on a tooltip
that can never appear. Re-firing per retry is idempotent for hover (mouseenter on an
already-hovered trigger is a no-op for Base UI's open state), so the loop converges as soon as
the listeners exist. The 5s timeout matches the suite-wide `asyncUtilTimeout` ceiling.

Failure modes considered:
- Two tooltips open at once → `screen.getByRole('tooltip')` throws "multiple elements", waitFor
  retries, and if both stay open the helper times out with that message — noisy but honest. The
  `unhoverTooltip` companion exists precisely so tests serialize hovers ("so the next
  hoverTooltip is the only tooltip open"); the contract is documented at the definition.
- A stale tooltip from a *previous* trigger still open when `hoverTooltip` is called on a new
  one: `getByRole` could match the stale popup on the first poll and return the wrong element.
  This is exactly what the documented unhover contract prevents; tests that follow it are safe,
  and the helper cannot distinguish tooltips by trigger without coupling to Base UI internals.
  Relied-upon caller discipline, noted rather than a bug.
- Events fired via `fireEvent` (not userEvent): fine for Base UI's mouseenter/mousemove opening
  logic, and much faster; consistent with the components' tests.

## Functions (low-level)

- `hoverTooltip(trigger)` — returns the tooltip element; async; retries as described. Verdict:
  correct.
- `unhoverTooltip(trigger)` — single mouseleave; Base UI closes on it. Verdict: correct.

## Bugs found

None found.
