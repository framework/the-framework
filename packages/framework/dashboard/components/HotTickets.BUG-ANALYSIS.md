# Bug analysis: packages/framework/dashboard/components/HotTickets.tsx

## Business logic (high-level)

The Overview's Hot tickets card (#1139): polls `onHotTickets` every 10s and projects the result
into three lanes — In progress + AI Queue stacked left, High priority alone right — each a full
(never truncated) list with a count, dimming to a header line when empty. Row click: with
`agentId` → `onSelectAgent(projectId, agentId)` (the session doing the work); without →
`stashPendingDraft(workOnTicketDraft(file))` then `onSelectProject` so the launcher arrives
pre-filled (#1066 hand-off, taken once by the composer). Card-level empty state names the three
lanes rather than claiming the backlog is empty.

Edge cases / invariants checked against the server shape (`src/dashboard/overview.ts`):

- `hotBucket` assigns each ticket at most one bucket, so a ticket cannot appear in two lanes and
  the per-lane key `${projectId}:${ticket.file}` is unique (ticket files are unique per repo, and
  the projectId disambiguates across repos). No duplicate-key churn.
- Draft stash happens only on the no-agent path (`openTicket`), so opening a session leaves no
  draft to leak into a later launcher visit (test-pinned).
- Poll: `onHotTickets` closes over nothing, deps `[]` — contract of `usePolled` honoured; a
  rejected poll keeps the last list (hook behaviour), initial `EMPTY` is module-stable so the
  first render doesn't churn.
- Tag precedence: `agentId` ("implementing", coloured) beats `planned` beats priority; ai-queue
  rows carry no tag. Matches the SPEC's "one tag per row, the one that earns the lane". A
  high-priority ticket with `priority` undefined can't occur (the bucket requires a high
  priority), and the `?? null` guard makes it harmless anyway.

## Functions (low-level)

- `workOnTicketDraft(file)`: the exact drain-vocabulary draft, exported so the test pins the
  string rather than a copy. Pure. Correct.
- `openTicket(ticket, onSelectProject)`: stash-then-navigate ordering is right (the launcher
  rehydrates at mount, after navigation). Correct.
- `LEFT_LANES` / `RIGHT_LANES`: dot colours primary/warning/info match the product's status
  vocabulary. Correct.
- `HotTickets({onSelectProject, onSelectAgent})`: poll + lane filter + empty state. `renderLane`
  filters per lane on each render — O(3n) on tiny lists, fine. Correct.
- `Lane({...})`: count always shown (also 0 when the card renders because another lane has
  entries); empty lane renders no `<ul>`; rows are buttons inside `TooltipTrigger render`,
  tooltip shows `summary || title` (empty summary falls back to the title rather than an empty
  bubble). Correct.
- `TicketTag({ticket})`: precedence chain as above; returns null for ai-queue and for an
  unplanned in-progress ticket with no agent (cannot occur server-side: in-progress requires
  implementing or planned — noted as a reliance, harmless). Correct.

## Bugs found

None found.
