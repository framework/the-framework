# Bug analysis: packages/framework/dashboard/components/TicketsPanel.test.tsx

## Business logic (high-level)

Comprehensive suite over the panel and the shared row, mocking only the two rpc modules and using
the real presets/`planTicketPrompt` — so the "one label, one instruction" claims are pinned against
the genuine preset text (`presets.updateTickets.render()`), not a restated copy. What it pins:

- One-liner rows: title shown, summary absent (moved to detail), claim marker inline with holder.
- Plan column: planned → link callback with the file slug; unplanned → start with the *exact*
  exported ask (asserted both against `planTicketPrompt(...)` and the literal string — double
  pinning so a drift in either the helper or the expectation is caught), `'prompt'` kind, attended
  (`options` `{}` asserted with `toEqual`).
- Start column: exact `workOnTicketPrompt` text (same double pinning), unattended + `ticket`
  option, `onAgentStarted` with the agent id, and no `onOpen` navigation.
- Selection checkbox: only when wired, reflects `isSelected`, toggles by file, never navigates;
  absent otherwise. (`data-checked` used for the Base-UI checkbox state — correct for this
  component library, where the role element is not a native input.)
- Click-to-filter: topic badge and claim marker fire their handlers without navigating.
- Row meta: "Priority: 8" spelled out, topics, "2d ago", effort/uncertainty, and the
  priority < date < github textual order via `indexOf` on the row's own `<li>` (all three first
  asserted present — sound).
- No re-sorting behind the caller (renders given order).
- GitHub link: href + no `onOpen` hijack, while the title click still opens.
- Update offers: empty state (single button, no stamp row), filled state (stamp + button), exact
  preset text, unattended option, `onAgentStarted` on ok, refusal path showing the daemon's error
  and calling nothing; stamp wording for known and unknown import times.
- Filtered-empty state shows the hidden count and no update offer.
- `projectId={null}` renders nothing (`container.textContent === ''`).

Every assertion tracks a real behavior; the exact-args and exact-text style makes the suite
sensitive to precisely the drift (#1187/#697) it cites. Hygiene: `onTicketsMeta` reset+re-armed in
`beforeEach`, `sendStart` reset in `afterEach`, `cleanup` throughout (including mid-test where two
renders are compared).

Timing note: the "3h ago" stamp assertion computes the timestamp from `Date.now()` and relies on
`formatRelative`'s rounding — at exactly 180 minutes it renders "3h ago" and stays so for the
test's duration (rounding, not flooring, so it cannot flip to "2h ago"); not flaky.

## Functions (low-level)

- **`ticket(over)`** — typed `Partial<WorkspaceTicket>` builder (stricter than the page suite's
  untyped one). Correct.
- Queries by accessible name (`Start work on…`, `Create a plan for…`, `View the plan for…`,
  `Select…`) — pin the aria-labels, which are the row's screen-reader contract. Correct.
- `sendStart.mock.calls[0]?.[n]` positional assertions — match `sendStart(projectId, text, kind,
  options)`. Correct.

## Bugs found

None found.
