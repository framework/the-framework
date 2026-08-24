# Bug analysis: packages/framework/dashboard/components/SystemPromptDisclosure.test.tsx

## Business logic (high-level)

Tests for the disclosure, run against the *real* `composeAgentSystem` (nothing mocked) — the right
choice for a component whose contract is "same composition as the agent". Suites:

1. **Transparent mode (#625)** — non-transparent renders the wrapped prompt (asserted via the
   "whole system prompt" caption and absence of the empty-branch text); transparent renders the
   "only the built-in system prompt of your AI model provider" branch. Real behaviors, can fail.
2. **Summary (#863)** — fully-enabled only with both axes on; `disabled` (vanilla) dims; transparent
   dims. The assertions rely on the sr-only text. Substring subtlety handled correctly: since
   "fully enabled" is a substring of "not fully enabled", the first test pairs
   `toContain('fully enabled')` with `not.toContain('not fully enabled')` — together they pin the
   positive state unambiguously. The dim tests use `toContain('not fully enabled')`, which is
   unambiguous on its own.
3. **Fine-grained options** — default checked states; unticking anti-laziness calls
   `onDisabledChange(true)`; unticking integration calls `onTransparentChange(true)`; transparent
   shows anti-laziness off+locked and integration off; integration row disabled when
   `onTransparentChange` is absent. These pin the SPEC's master-off-switch and fixed-row rules.
4. **Browser section** — with `browser`, the `<pre>` text is strictly longer than without; also
   asserts the plain text is non-empty, so the comparison cannot pass vacuously on two empty
   strings. Good.

Coverage gaps (not bugs of this file): no test that a `handsOff` (web-target) run's protocol appears
— it cannot, since the component has no such input (see the source-file analysis, bug 1); no test of
the `user` (SYSTEM.md) or `context` inclusion, which StartAgentForm's spec relies on. The tests
verify what they claim for what they cover.

## Functions (low-level)

- **`openDisclosure()`** — clicks the trigger by its label regex; the popover content then renders
  (portal or inline — queries go through `screen`/`document`, so either works). Correct.
- **`summary()`** — `screen.getAllByRole('button')[0]?.textContent ?? ''`: the trigger is the first
  button in a fresh render (checkbox inputs are not role=button). Fragile ordering but correct in
  every test here (called before opening, single component rendered). Verdict: correct.
- **`baseProps`** — includes `autopilot: false` and `eco: undefined`, which are **not** props of the
  component (leftovers from an earlier prop shape); TypeScript excess-property checking doesn't
  flag them because the object is spread. Harmless at runtime (unknown props are simply unused —
  they are destructured away), so cruft, not a bug.
- **Transparent tests** — assert on real composition output branches. Correct.
- **Summary tests** — as analyzed above; the fourth test ("state is not carried by the dot alone")
  duplicates the first's positive assertion but does document the sr-only requirement. Cannot-fail?
  No — it fails if the sr-only text is removed, which is its point.
- **Checkbox tests** — use `getByLabelText`, so they also pin that the labels are real `<label>`
  associations. `fireEvent.click` on a disabled input does not fire — and indeed the one test that
  clicks anti-laziness first renders it enabled. Correct.
- **Browser test** — renders, reads `document.querySelector('pre')`, unmounts, re-renders with
  `browser`. Uses `unmount` (not `cleanup`) between, so no duplicate DOM at the second query.
  Correct.

## Bugs found

None found.
