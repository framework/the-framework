# Bug analysis: packages/framework/dashboard/components/AgentActionsMenu.test.tsx

## Business logic (high-level)

Tests the ⋮ menu with the five control RPCs, the GitHub-URL read, preferences and editor
detection mocked (hoisted `vi.fn`s + `vi.mock` before a top-level `await import` — correct
vitest pattern; the mock module for `../rpc/control.js` exports exactly the five names the
component imports). What the suite pins, against its test SPEC:

- The menu gathers GitHub / folder / editor / delete in one place (presence assertions after
  opening the menu).
- The folder item addresses the agent (`sendOpenInApp('p1','files','run-1')`) and is named for
  what it opens: "Open project folder" for a finished non-retained run, "Open session's folder"
  when `retainedWorktree` — both directions asserted, including the negative
  (`queryByText("Open session's folder")` null).
- The resume-command item: session-id fragment visible, exact command string
  (`mkdir -p … && cd … && claude --resume <uuid>`) written to a stubbed
  `navigator.clipboard.writeText`, and the "Copied" confirmation appears; a run with no session
  offers neither copy item. The clipboard stub is assigned onto `navigator` because jsdom has
  none — which incidentally documents the component's hard dependency on
  `navigator.clipboard` (see AgentActionsMenu.BUG-ANALYSIS.md Bug 3: absent on insecure
  origins, the click is a silent no-op — untested here).
- Delete: confirm dialog appears, `sendDeleteAgent` **not** called before confirmation, called
  with the right args after — the ordering assertion is the valuable one and it is present.
- Live vs ended: a live run offers Stop and "Merge when finished"; an ended run offers neither.
- Merge: clicking sends `sendMerge('p1','run-1')`.

Weakness: the merge test's name — "sends the control and stays armed — a pre-commitment,
nothing to press twice" — and the test SPEC's "the merge authorization is recorded once" claim
the latch, but the test only asserts the RPC call; nothing asserts the item now reads "Merge
armed" or is disabled, so removing the `mergeRequested` latch entirely would still pass the
whole suite (Bug 1). Stop's latch ("Stopping…" until the agent ends) is likewise unasserted,
but no test *claims* it, so that is a plain coverage gap (noted), not a wrong assertion.

Hygiene: `beforeEach` clears only `sendOpenInApp`/`sendDeleteAgent` and the merge test clears
`sendMerge` itself — the other mocks are only ever presence-checked or arg-checked within one
test, so no cross-test bleed; `afterEach(cleanup)`; all menu opens/clicks awaited via
`findBy*`/`waitFor`. The `as never` event casts are the pragmatic way to feed minimal event
shapes; they exercise the real `sessionInfo`/`isAgentActive` code paths (a `log` event makes the
segment active; adding `end` deactivates it), so the live/ended gating is genuinely tested.

## Functions (low-level)

- **module mocks (L6-23)** — see above. Correct.
- **`openMenu` (L25)** — clicks the trigger by its aria-label. Correct.
- **"folds the session actions" (L34-42)** — presence of the four items. Correct.
- **"opening the folder addresses this session" (L44-49)** — arg assertion including the agent
  id — pins the #1195 always-addresses-the-agent behavior. Correct.
- **"names the folder item…" (L51-64)** — two renders with explicit mid-test `cleanup()`;
  positive and negative naming assertions. Correct.
- **"copies the command…" (L66-85)** — exact-string clipboard assertion plus the "Copied"
  flash. Correct.
- **"offers nothing to copy…" (L87-93)** — waits for the menu, then asserts both copy variants
  absent. Correct.
- **"Delete asks to confirm" (L95-105)** — dialog shown, not-called-until-confirmed, then
  called-with. Correct.
- **live/ended trio (L108-134)** — presence, merge RPC args, and the ended-run negatives.
  Merge's armed-state claim unasserted (Bug 1); otherwise correct.

## Bugs found

1. `L118-L124`: **The merge test claims "stays armed — nothing to press twice" but never asserts
   it, so the latch is unprotected.** The test (and the test SPEC's "the merge authorization is
   recorded once") promises the pre-commitment behavior, yet the only assertion is
   `sendMerge` having been called once with the right args; deleting the `mergeRequested` state
   from the component — leaving a re-fireable "Merge when finished" that could send the control
   twice — fails nothing in this suite. A test that asserts less than it claims documents a
   guarantee it does not enforce. Severity: minor. Fix: after the click, assert the item now
   reads "Merge armed" and is disabled (e.g. `await screen.findByText('Merge armed')` and check
   `aria-disabled`/`disabled`), and optionally click again and assert `sendMerge` was not called
   a second time.
