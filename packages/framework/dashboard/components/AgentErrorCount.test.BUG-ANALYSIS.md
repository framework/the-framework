# Bug analysis: packages/framework/dashboard/components/AgentErrorCount.test.tsx

## Business logic (high-level)

Four synchronous rendering tests, no mocks (the component and the real `agentErrors` fold both
run). Coverage matches `AgentErrorCount.test.SPEC.md` exactly:

1. No errors → empty container. Uses a non-error event (`ready-for-merge`) rather than `[]`, so
   the fold's filter is actually exercised. Can fail if the component rendered anything. ✓
2. One error with `headline` prop → "1 error" (singular pinned) + headline text visible. ✓
3. One error without `headline` prop → count alone; `queryByText` proves the headline is absent
   from the DOM (not merely visually truncated — a stronger, honest assertion of the "tight row"
   rule). ✓
4. Two errors → "2 errors" (plural) + latest headline shown, earlier one asserted absent from
   the inline row. ✓

Each test would fail if its behavior regressed (wrong pluralization, first-instead-of-last
headline, headline leaking into the tight row, or a stray zero-state render). Nothing async, so
no missing awaits; `cleanup` in `afterEach` prevents cross-test DOM bleed.

Note on test 4's last assertion: `queryByText(/first thing broke/)` is null because the tooltip
content (which joins *all* headlines) is not mounted until the trigger is hovered — the
assertion therefore pins the inline row only, which is what the SPEC claims. If the tooltip
primitive ever rendered its content eagerly, this test would start failing for the wrong reason;
acceptable coupling, recorded here.

## Functions (low-level)

- **Test data** — events are cast through `FrameworkEvent[]` with the real `error` shape
  (`kind`, `headline`); `detail` unused, matching the component's surface. Correct.
- **Assertions** — `getByText('1 error')`/`'2 errors'` are exact-match (headline lives in a
  sibling span, so text-node splitting does not break the exact match). Correct.

## Bugs found

None found.
