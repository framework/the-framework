# Bug analysis: packages/framework/dashboard/components/AiQueue.test.tsx

## Business logic (high-level)

Fifteen tests, matching `AiQueue.test.SPEC.md` bullet-for-bullet. Mocking is minimal and
honest: preferences and `useStartAgent` are replaced (the card's own logic all runs), with
`busy`/`startError` as mutable module lets so tests can pin the disabled/error renders without
driving the real hook's async. The real `queueEntryLabel`, `workOnEntryPrompt` and
`fanOutLabel` run — the exported-prompt/label pattern means tests assert against the real
strings, not copies.

Notable strengths, verified test by test:

- Ticket row: asserts label text, `title` = raw line, and `onOpenTicket('p1', '<file>.md')`
  with the bare slug — pins the `queueEntryLabel` integration. External link: tagName/href/
  target. Plain entry: tagName SPAN plus a button *count* (2 = play + fan-out), proving the
  title itself is not clickable.
- Play start: clicks the *second* row's button so the prompt provably carries the clicked
  entry; asserts the full tuple (project, exact prompt via `workOnEntryPrompt`, kind,
  `unattended: true`) and the navigation callback with the started id. The no-id and failure
  variants pin the adopt fallback and the alert + no-navigation. All awaited via `waitFor`.
- Disabled-during-start: `busy = true` render-time, every button disabled (loop over all).
- Fan-out: fixture puts a `done` entry second so "top three open" is provably open-order;
  asserts the three prompts in order, per-call options, and zero navigations. Count box drives
  the batch (change to '2'); cap test uses a two-entry queue against the default three and
  clicks by the capped label (so the label content is itself asserted); singular label pinned.
- First-refusal: `mockResolvedValueOnce(ok).mockResolvedValueOnce(undefined)`, waits for 2
  calls, then a macrotask flush before asserting no third call — the flush makes the negative
  assertion meaningful (a queued third start would have fired by then). Sound.
- Mid-batch disable: deferred promises (`releases`), asserts every button disabled *between*
  the first and second start — exactly the `busy`-gap the separate `fanningOut` flag exists
  for — then re-enabled after the batch. This test fails if `inFlight` were `busy` alone. The
  final `waitFor` loops over buttons inside the callback — fine, it settles when all enable.
- Done/empty filtering and loading-vs-empty round out the list.

Async hygiene: every start-path test awaits its `waitFor`; no floating promises (the
`void`-invoked handlers are driven through fireEvent and observed via the mock). `cleanup` +
`beforeEach` resets (including re-priming `start`'s resolved value after `mockReset`).

Gaps (none claimed by the test SPEC): the per-row spinner (`starting === key` content keying)
and the count input's empty-string mid-edit behavior are unpinned; both are cosmetic latches.

## Functions (low-level)

- **`queue(items, over)` (L23)** — derives `open`/`total` from the items so fixtures cannot
  disagree with themselves; overrides for the second project. Correct.
- **Module-let mocking (`busy`, `startError`, `prefs`)** — reset in `beforeEach`; because the
  mock returns fresh objects per render, mutations require a re-render to show, and every test
  that mutates them does so before `render`. Correct.
- **Assertions** — role-based queries (`spinbutton`, `button` by accessible name) match the
  component's aria-labels; `toMatchObject` for options keeps the tests robust to added
  preference-derived fields. Correct.

## Bugs found

None found.
