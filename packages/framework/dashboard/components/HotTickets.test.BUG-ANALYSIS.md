# Bug analysis: packages/framework/dashboard/components/HotTickets.test.tsx

## Business logic (high-level)

Covers the test SPEC's three areas: lane grouping + honest empty state, the "implementing" tag
(outranking "planned", present even with no plan), and row-click routing (agent → session and
never the project; no agent → project + stashed draft naming the ticket *file*; agent click
leaves no draft).

Verification that the tests test what they claim:

- The draft round-trip uses the real `draft-handoff` module (only the RPC is mocked), so
  `takePendingDraft()` asserting `workOnTicketDraft('b.md')` genuinely proves the stash-once
  hand-off, and the `afterEach` drain (`takePendingDraft()`) prevents cross-test leakage from the
  module-level stash — a real hazard the suite correctly handles.
- Async hygiene: every first assertion after `render` is an awaited `waitFor`/`findByText`;
  clicks are on the resolved rows. No un-awaited promises.
- Negative assertions are present where they matter (`onSelectProject).not.toHaveBeenCalled()`,
  `takePendingDraft()).toBeNull()`), so the routing tests can fail in both directions.
- The "implementing outranks planned" test renders two rows in the same lane and asserts both
  tags coexist — pinning that the tag is per-row, not per-lane.
- `workOnTicketDraft` is asserted against the exported function (`toContain('tickets/add-oauth.md')`),
  matching the source's "no second hidden copy" intent; the exact-equality check in the stash test
  pins the full wording.

Fixture notes: `ht()` sets `projectId: projectName` — harmless collapsing for these assertions
(`picked` compares against the same value). `onHotTickets` is `vi.hoisted` + module mock, reset
implicitly by `mockResolvedValue` per test; call history is never asserted, so the missing
`mockClear` in `afterEach` cannot mis-assert. The 10s poll interval never fires within a test and
`cleanup` unmounts it.

Minor observation (not a bug): the describe title says `#1112` while the card's issue is `#1139` —
comment-level drift only.

## Functions (low-level)

- `onHotTickets` hoisted mock + `vi.mock('../rpc/reads.js')`: correct pattern before the dynamic
  imports (both the component and the real draft-handoff are imported after, so they bind to the
  mocked RPC module). Correct.
- `ht(file, projectName, bucket, over)`: builds a minimal `HotTicket` (title derived from file,
  `planned: false` default, overrides spread last). Correct.
- Each test: arranges fixtures, drives clicks, asserts routing/tags/drafts. All falsifiable.
  Correct.

## Bugs found

None found.
