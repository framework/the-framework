# Bug analysis: packages/framework/dashboard/components/TicketsPage.tsx

## Business logic (high-level)

The cross-project Tickets page (#1144): polls `onAllTickets` every 10s, owns the URL-mirrored
`TicketsView` (filters/sort/group), renders grouped sections (each its own `TicketsPanel`) or the
flat pooled list, the shown/total tally, the two header queue-adds (tickets, plans) with their
selection narrowing, and the flat rows' own plan/work starts.

Checked against `TicketsPage.SPEC.md`:

- **URL is the view** — `initialView` lazily parses `location.search` on mount; every `setView`
  mirrors via `replaceState` (no Back steps). Round-trip verified against
  `parseTicketsView`/`formatTicketsView`. Navigating to a detail page and back remounts the page
  (different component branch in App), which re-reads the replaceState-updated entry, so filters
  survive the detour. No popstate listener is needed because filter changes never push entries.
- **Grouped/flat** — grouped: `shownGroups` (project-facet-deselected projects dropped entirely —
  spec's silent-disappear rule) with per-section `sortRows` and per-section
  `hiddenByFilter = g.tickets.length - groupRows.length`; flat: one `sortRows` pool, rows carrying
  `projectName`, no per-project update bars, hidden-count banner + Clear. All match. (The flat
  banner's hidden count includes tickets hidden by a project deselection — the spec's
  silent-disappear rationale is about grouped sections, so not flagged.)
- **Click-to-filter** — `addTopic` (additive, deduped) and `filterClaimed` (adds `claimed` stage) —
  additive and no-op-when-present per spec; but `addTopic` misses the lowercase invariant — bug 1.
- **Plan/work from the flat row** — `startPlan` attended (matches TicketsPanel's deliberate
  attended plan start), `startWork` unattended with `ticket: 'tickets/<file>'` — matches spec and
  panel behavior; failures land in the shared `error` above the toolbar.
- **Queue the shown set / queue plans** — both walk the shown order, per-row project, dedupe by a
  click-time `readOpenQueue()` (open entries only: exact-text set and linked-ticket set, keyed
  `projectId\n…` so same filenames across projects cannot collide); ticket add skips claimed and
  already-linked; plan add additionally skips planned, exact plan-ask text
  (`planTicketPrompt` — verified byte-identical to what `sendQueueTicketPlan` writes server-side),
  and implementation-linked tickets. Stop-at-first-failure with the daemon's reason, partial
  progress kept. Rested "Queued"/"Plans queued" is keyed to the exact acted-on set
  (`join('\n')` of projectId/file — unambiguous since neither part contains newlines) and re-arms
  on any set change. Buttons render only when their target list is non-empty. All match spec.
- **Selection** — page-owned `Set` keyed `projectId/file`; `selectedShown` intersects with the
  currently shown rows, so hidden ticks are neither counted nor acted on but survive; readout +
  Clear selection; labels switch to "selected" wording; rest-keys naturally differ per scope. All
  match spec, including "with every selected row hidden, the buttons speak for the whole shown set".

Concurrency: all header/row actions share one `useAction`, so at most one mutation runs at a time
and every start/queue button disables on `busy`. The 10s poll can change `targets` between render
and click; the click handler uses its render's snapshot — consistent with "what the buttons act on
is always visible below". `readOpenQueue` re-reads at click time, so a queue drained or extended by
agents since the last poll is still deduped correctly.

## Functions (low-level)

- **`initialView`** — SSR-guarded; lazy `useState` initializer (function reference passed, invoked
  once). Correct.
- **`setView`** — state + replaceState (`pathname` + optional `?qs`). Drops any hash — none is used
  in this app. Correct.
- **`addTopic(topic)`** — raw-cased push; see bug 1.
- **`filterClaimed`** — guarded additive stage append. Correct.
- **`readOpenQueue`** — builds `texts` (trimmed) and `tickets` (via `queueEntryLabel`, bare file)
  sets from open items only. Correct; a malformed entry simply doesn't dedupe (harmless).
- **`queueShownTickets(targets, key)`** — sequential, skip-by-link, first failure returns
  `{ok:false,error}` (useAction shows it), success sets `queuedKey`. Correct.
- **`queueShownPlans(targets, key)`** — sequential, skip by exact plan text then by link, same
  failure/success handling. Correct.
- **`startPlan` / `startWork`** — flat-mode per-row starts, mirroring the panel's options exactly
  (verified side-by-side). Correct.
- **Derived values** — `rows` memoized on `groups`; `visible`, `flatRows`, `targets`,
  `planTargets`, counts and labels recomputed per render (pure). Label branch matrix covers
  1/many × claimed-skipped × selection — verified against the spec's wording and the tests. Correct.
- **Render** — loading / no-projects / flat / grouped branches; tally only when
  `loaded && rows.length > 0`. Correct.

## Bugs found

1. `L73-L75` (`addTopic`): click-to-filter breaks for any topic containing an uppercase letter —
   the raw badge text is pushed into `filters.topics`, but `TicketFilters.topics` is documented and
   everywhere else maintained as lowercase (`parseTicketsView` lowercases, the facet lists
   lowercased topics, and matching compares against `normalTopics`' lowercase). Scenario: a ticket
   has `topics: [UX]` (topics are parsed verbatim server-side — `src/dashboard/tickets.ts`
   `describe()` only trims); clicking the row's `UX` badge sets `topics: ['UX']`, and
   `matchesFilters` then finds `'UX'` in no ticket's lowercased topics — the page flips to
   "No tickets match." with the Topics facet showing a phantom zero-count `UX` row beside the real
   `ux` one. (Reloading the resulting URL "fixes" it because the URL parser lowercases — proof the
   in-memory path missed the normalization.) Contradicts the SPEC's click-to-filter story
   ("everything else carrying it") outright. Severity: major. Fix sketch: `addTopic` should insert
   `topic.toLowerCase()` (dedupe against the lowered value too).
