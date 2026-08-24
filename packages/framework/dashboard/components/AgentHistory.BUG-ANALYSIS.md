# Bug analysis: packages/framework/dashboard/components/AgentHistory.tsx

## Business logic (high-level)

The left rail on every route: brand, New launcher, Overview/Tickets/Projects nav, the recent
agents list (project-scoped or, on the Overview, pooled `recentAgents`), footer chrome. Checked
against `AgentHistory.SPEC.md` section by section.

**Optimistic "starting…" row** — one state atom `{intent, known}` snapshotted when `startTick`
bumps (deliberately depending on `startTick` alone so `known` is the list *at Start*, which the
"survives an older run" test pins). Retired by: `landed` (any agent not in `known` — covers a
run that starts and fails inside one poll interval), a project switch, or a 20s deadline.
`showOptimistic` also re-checks `landed` so the stand-in and the real row never paint together
for the effect-queued frame — sound. The extra `!hasRunning` gate is consistent with the
daemon's one-run-per-project busy guard (a successful Start implies nothing else is running);
its only cost is a ≤2s window after a previous agent ends where the poll still says `running`
and the new start's row is briefly suppressed — transient, noted, not filed. Deadline effect
cleans its timeout; correct.

**Highlight rules** — SPEC: "Exactly one of these carries the active highlight." In-project
launcher → New (`atProjectLauncher`); Overview → `projectId === null && !ticketsActive`;
Tickets → `ticketsActive`; agent row → selected or (followLive → newest running). The follow
case highlights only the newest running row (`agents` newest-first). Overview rows are never
active. **Bug 1**: on a ticket's own page (`/{projectId}/tickets/{slug}`, also `/plan`) the
route has a non-null `projectId` with `agentId === null`, so `atProjectLauncher` is true while
`ticketsActive` is also true — New and Tickets are both lit at once. Related (ambiguous, see
bug 3): on the Settings page (`projectId === null`, view `settings`) the Overview row is lit
although the Overview is not the current view.

**Rows** — status word + dot: running pulses, parked (settled while running, or cloud
`waiting`) reads "waiting" with the still dot *only when `status === 'running'`* — a cloud-
waiting run has status `done`, so it gets no dot at all (bug 2); publishing (ended clean,
armed push, no report — `isMetaPublishing`) pulses green and is outranked by any cloud word
(`publishingNow = publishing && !cloud`, matching the "in cloud outranks publishing" comment);
cloud words from `cloudRunState` (waiting/in-cloud/merged, `done` falls through to the stored
status — correct, `status` is `done` in every `cloudState === 'done'` case by construction).
Meta line: project name leads only on the Overview; relative time; right cluster of glyphs
(other-host laptop, device, cloud, driver logo) each with tooltip + aria-label; driver via
`driverFromImpl` so `claude-web` rows still say Claude. Title overflow measured
(`scrollWidth > clientWidth + 1`) on `[intent]` — fine for a fixed-width rail; tooltip only
when overflowing, plain span otherwise (test-pinned).

**New button** — in project / single project → direct start; none → add-project dialog;
several → picker with activated dots. Matches SPEC. `projects[0]!` guarded by the
`length === 1` branch condition. Correct.

**Projects nav** — expandable list, red dot with `projectErrorTitle`-joined tooltip + sr-only
text for errors, activated/muted dots, Add project. Matches SPEC.

Lifecycle/cleanup: the one `setTimeout` is cleaned up; no subscriptions. State that could go
stale across prop changes: `optimistic` (reset on projectId change — handled), `ProjectsNav
open`/`adding` (harmless persistence), `overflowing` (recomputed per intent).

## Functions (low-level)

- **`AgentHistory` (L50)** — see above. Edge: `crossProject` requires `recentAgents !==
  undefined`, so a caller that omits it (the relay) falls back to the project list — safe.
  `hasRecents` includes the optimistic row so "No agents yet." never sits under a starting row.
  Verdict: bug 1 aside, correct.
- **`TicketsButton` (L297)** — plain nav row; stale comment ("Only rendered once a project is
  selected" — actually gated on `onTickets`), behavior correct.
- **`OverviewButton` (L317)** — badge only when count > 0, singular/plural tooltip. Correct
  in itself; its `active` input is wrong on the settings route (bug 3, fix at the callsite
  expression L207 or in `App.tsx`).
- **`ProjectsNav` (L353)** — chevron rotation off `open`; error dot precedence (errors > 
  activated > muted) matches SPEC; tooltip joins every error. Correct.
- **`NewButton` (L441)** — three-way behavior; `start()` falls back to `onSelect(null)` when no
  `onNewAgentInProject` (test-only path). Correct.
- **`AgentHistoryRow` (L521)** — `parked`, `inCloud`, `cloudWord`, `publishingNow` derivations
  as analyzed; the badge chain `parked → in cloud → merged → publishing… → status` gives the
  SPEC's precedence. Dot rendering: bug 2. Overflow measurement effect: correct, no cleanup
  needed. Verdict: bug 2 aside, correct.

## Bugs found

1. **L177: two nav items highlighted at once on a ticket's detail/plan page.** Scenario: open
   Tickets, click into a ticket — the route becomes `{view:'tickets', projectId:'p1',
   agentId:null, ticketSlug}` (`App.tsx` `openTicket`); `atProjectLauncher = projectId !==
   null && selectedAgentId === null && !followLive` is true, so New carries the active fill
   while TicketsButton does too (`ticketsActive`). Contradicts the SPEC's "Exactly one of
   these carries the active highlight" and mislabels the current view as the project
   launcher. Severity: minor. Fix: `const atProjectLauncher = projectId !== null &&
   selectedAgentId === null && !followLive && !ticketsActive`.
2. **L603: a cloud-waiting run gets no still dot.** The dot block renders only for `status ===
   'running'`, but a web run parked on a bridge question has status `done` with `cloudState
   === 'waiting'` — the row reads "waiting" with no dot, while the SPEC says "'waiting' with a
   still dot when the browser bridge holds a question its session is parked on" (and the local
   parked row does show one, so the two waiting states render differently). Severity: minor.
   Fix: render the still dot when `parked` regardless of status, e.g. change the guard to
   `(status === 'running' || cloudState === 'waiting')`.
3. **L207 (with `App.tsx`): the Overview row stays highlighted on the Settings page.**
   `active={projectId === null && !ticketsActive}` is true on `/settings` (route has
   `projectId: null`, view `settings`), so Overview reads as the current view while the
   Settings page is open — the SPEC ties each highlight to its view being open ("Overview
   while the Overview is"). Severity: minor. Confidence: low — the SPEC's "exactly one" could
   be read as requiring some row to stay lit, and Settings is footer chrome without an active
   state of its own. Fix sketch: pass a `settingsActive` (or reuse a `view` prop) and exclude
   it, as `ticketsActive` already does.
