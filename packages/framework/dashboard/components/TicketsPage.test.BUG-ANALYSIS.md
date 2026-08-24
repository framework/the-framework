# Bug analysis: packages/framework/dashboard/components/TicketsPage.test.tsx

## Business logic (high-level)

A large, well-structured suite over the page with rpc reads and controls mocked (TicketsPanel and
TicketFilterBar render for real — appropriate, since the page's behavior is their composition).
Suites and what they genuinely pin:

- **Base** — per-project sections, row open callback with project+file, empty-project update offer,
  no-projects message, and the section-bound `onAgentStarted('p1', …)` projectId threading.
- **Sort** — default keeps server order (fixture dates equal, so the always-applied date sort
  degrades to the stable tie-break — consistent with the comment), priority re-sort with URL
  `?sort=priority`, and the newest-first tie-break.
- **Filters** — search narrows + `?q=` written + tally 2/2 → 1/2; URL as initial state; topic-badge
  click (lowercase `dx` fixture — the uppercase-topic bug found in the source analysis is exactly
  the case this suite does not cover); claim-marker click with `?stage=claimed`; filtered-to-
  nothing shows the hidden count, no update offer, and Clear restores + empties the URL.
- **Grouping** — flat list with project names on rows, cross-project priority order, no update
  bars; flat open and flat start-work carry the row's own project; start-work args pinned exactly
  (`'prompt'`, `{ unattended: true, ticket: 'tickets/b.md' }`).
- **Queue-add** — args per ticket (title + file + priority), no `sendStart`, rested disabled
  "Queued", re-arm on set change; open-entry dedupe (link with trailing note counts, a `done`
  entry does not); claimed skip with the exact narrowed label; both no-offer states (nothing shown /
  all claimed).
- **Plan queue-add** — one `sendQueueTicketPlan` per unplanned unclaimed ticket with priority, no
  implementation entries, rested state; planned+claimed skip with exact label; exact-text plan-ask
  dedupe and implementation-link dedupe; all-planned hides only the plan button.
- **Selection** — narrowing of both buttons with exact labels and args, re-arm on selection change,
  readout + Clear selection, claimed-in-selection skip, hidden-selected rows neither counted nor
  acted on but the tick surviving (asserted via `data-checked` after the filter releases the row),
  and flat-mode selection acting on the row's own project.

The assertions are precise (exact accessible names, exact call args) — the suite would catch label
drift, skip-rule regressions, and cross-project mixups. Mock hygiene: `onTicketsMeta`/`onQueue`
reset + re-armed and the URL reset in `beforeEach`; `controls()` clears the control mocks per test
that clicks. `sendStart`/`sendQueueTicket*` are module-level `vi.fn()`s that are only cleared via
`controls()` — the few tests that use `sendStart` without `controls()` (base suite's update test)
set their own `mockResolvedValue`, and none of those assert call counts across tests, so no bleed.

One nuance verified rather than assumed: the URL reset uses `replaceState('/tickets')` in
`beforeEach`, so a prior test's replaceState mirror cannot leak into `initialView`.

## Functions (low-level)

- **`ticket(over)`** — untyped record builder (`Record<string, unknown>`), loose but adequate.
- **`controls()`** — imports the mocked module and re-arms ok-results; returns the mocks for
  assertions. Correct.
- Order assertions use `findIndex` over button textContents — resilient to extra buttons since
  they compare relative positions and first assert both present (`-1` would still order-compare,
  but both titles are asserted rendered beforehand via `findByText`). Adequate.
- The rest-state assertions (`name: 'Queued'` + `.disabled`) verify both label and gating. Correct.

## Bugs found

None found. (Coverage gap worth noting for the orchestrator: no test clicks a topic badge with an
uppercase topic, which is what lets TicketsPage.tsx's `addTopic` case bug — reported against the
source file — pass this suite.)
