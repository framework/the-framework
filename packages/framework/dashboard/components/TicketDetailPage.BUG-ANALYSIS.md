# Bug analysis: packages/framework/dashboard/components/TicketDetailPage.tsx

## Business logic (high-level)

One ticket's page (#1144): fetched by identity (`onTicket(projectId, slug)`, the filename), polled
every 10s, with two actions — Queue (#1164) and Release lock (#1420) — and the full meta row
(#1265 order: age, priority, GitHub link, topics, planned, claim, effort, uncertainty, filename).

Checked against `TicketDetailPage.SPEC.md`:

- **Loading / missing states** — `loaded` (from `usePolled`) distinguishes "not read yet" from
  "read null": "Loading…" until the first successful read, then "This ticket does not exist." for a
  null answer. Correct; a rejected read keeps "Loading…" forever only if the daemon never answers,
  which the app-level health banner covers (reliance noted).
- **Queue once** — `queued` flips on `result?.ok`; button disabled by `busy || queued`, label flips
  to "Queued". Failure leaves the button and shows the error (the RPC's own message; the fallback
  string only when it carries none — spec's quoted text is the fallback). Matches spec.
- **Release** — offered only while `claimed = Boolean(ticket?.locked) && !released`; on success
  `released` bridges until the next poll. Failure shows the message, claim stays. Matches spec —
  with the sticky-flag caveats in the bugs below.
- **Meta order** — rendered exactly in the spec's order, claim badge shows holder inline, exact
  timestamp on the age's `title`. `priority` badge only when set; effort/uncertainty use
  `!== undefined` so a `0` renders (test pins uncertainty 0). Correct.
- **Polling lifecycle** — `usePolled` deps `[projectId, slug]` reset value+interval on identity
  change and clean up on unmount. Correct.

Concurrency/ordering: the two actions share one `useAction`, so a queue and a release cannot run
concurrently from this page (both buttons disable on `busy`) — fine. The 10s poll can overwrite
nothing the flags derive from incorrectly except as described in bugs 1–2.

## Functions (low-level)

- **`TicketDetailPage(props)`**
  - `queue()` — no-ops without a ticket; sends title + `{ file, priority? }` (priority spread only
    when truthy — priorities are non-empty strings like `'8'`; `''`/absent both mean unset, so no
    loss). Sets `queued` only on `ok`. Correct.
  - `release()` — no-ops without a ticket; sends `(projectId, ticket.file)`; sets `released` on
    `ok`. Correct in the immediate flow; see bug 1 for the flag's lifetime.
  - `claimed` — derived per render. Correct given fresh flags.
  - Render — three-branch body; error paragraph only inside the loaded-ticket branch (both actions
    require a ticket, so an error can only exist there). GitHub link `target="_blank" rel="noreferrer"`.
    Badges keyed by topic (duplicate topic strings would collide keys — ticket topics are a set in
    practice; reliance noted). Correct.

## Bugs found

1. `L46-L52`: `released` never resets, so a *new* claim on the same ticket is hidden for the rest of
   the page's lifetime. Scenario: a human releases a dead agent's lock (`released` → true); minutes
   later, while the page is still open, Auto PM's next sweep claims the same ticket
   (`locked: true, lockedBy: 'plan-2-…'` arrives on the 10s poll) — but
   `claimed = locked && !released` stays false, so the page shows the ticket as unclaimed and offers
   no Release button, contradicting the SPEC's own rationale that hiding a live claim "would let two
   agents work the same ticket" (the claimed badge is the page's only claim signal). Severity:
   minor. Fix sketch: clear `released` once a poll confirms the release
   (`useEffect(() => { if (ticket && !ticket.locked) setReleased(false) }, [ticket?.locked])`), or
   remember the released `lockedBy` and only suppress a claim by that same holder.

2. `L32`/`L46` (fix equally placeable at `App.tsx:285`): `queued` and `released` leak across tickets
   when the slug changes on a mounted instance. The poll resets via its `[projectId, slug]` deps,
   but the two `useState` flags do not, and App renders `<TicketDetailPage>` without a `key`.
   Scenario: open ticket A, back to the list, open ticket B, queue B; then jump directly back to A's
   history entry (browser back-button long-press → pick the A entry — a single popstate, no list
   render in between). A's page now shows "Queued" disabled although A was never queued (and a
   `released` leak would likewise hide A's claim). Severity: minor (needs a multi-entry history
   jump; ordinary Back always passes through the list, which unmounts). Fix sketch: render with
   `key={slug}` in App.tsx (also covers TicketPlanPage's `saved` flag), or reset both flags in an
   effect on `[projectId, slug]`.
