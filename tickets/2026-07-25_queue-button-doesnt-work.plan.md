Effort: 3
Uncertainty: 3

# [Plan] `Queue` button doesn't seem to work?

Close the reopened half of #1164: make the queued state persistent and make it say what happens next, so queueing a ticket no longer reads as a silent no-op.

## TLDR

The write-side and read-side fixes already shipped (PR #1168: the entry lands in the matching `## Priority N` section and links back to its ticket; `dashboard/lib/queue-entry.ts` + `AiQueue.tsx`: entries render as readable titles). The issue was **reopened** anyway ("Still having this issue. What should I do now?") because the *experience* is still a dead end:

1. **The queued state is not persistent.** `TicketDetailPage.tsx` tracks `queued` in component-local `useState(false)`; `WorkspaceTicketDetail` carries no "already queued" fact. Reload the page and the button reads `Queue` again — it looks like the click never worked, and clicking again writes a duplicate entry.
2. **Nothing says what happens next.** The button flips to `Queued ✓` and stops. If the queue-drain routine / autonomous mode is off, nothing will ever pick the entry up — from the user's chair, the button genuinely does nothing.

## Problems

- **What the queued state should say/offer (uncertainty ~4).** Options range from a one-line hint to a full "start an agent now" action on the ticket page. The mechanics all exist; the UX shape is the open question.
- **Where "is this ticket queued?" is computed (uncertainty ~2).** The projection already exists in `src/dashboard/overview.ts` (`queuedTicketFile`, feeding the Hot Tickets `ai-queue` lane) and `dashboard/lib/queue-entry.ts` mirrors it; it just isn't exposed on the single-ticket read.

## Solutions

For the post-queue guidance, in increasing effort:

1. **Static hint** — `Queued ✓` plus one muted line: "On the AI Queue — the next drain sweep picks it up." Cheapest; still wrong when the routine is off.
2. **Routine-aware hint** (recommended) — the line reflects whether anything will actually drain the queue: routine on → "the AI picks it up next sweep"; off → "autonomous work is off — start an agent on it, or turn on the routine". This answers "What should I do now?" exactly.
3. **Full action** — also add a "Start agent now" button on the ticket page, reusing `AiQueue.tsx`'s `workOnEntryPrompt` + unattended start (#1279). Nicest, but duplicates the play button that already exists one click away on the Overview's AI Queue card.

## Implementation

1. **Expose the queued fact on the single-ticket read.** Extend `readTicket` / `WorkspaceTicketDetail` (`src/dashboard/tickets.ts`) with `queued: boolean`: scan the project's `TODO_AGENTS.md` open entries and match a leading `tickets/<file>` link, reusing the existing gate (`ticketFromTodoEntry` in `src/tickets.ts` / `queuedTicketFile` in `overview.ts`) rather than a third regex copy.
2. **Initialize the button from it.** `TicketDetailPage.tsx` seeds `queued` from the polled detail, so the state survives reloads and stays consistent across devices.
3. **Refuse the double write.** `sendQueueTicket` (`src/dashboard-rpc/control.ts`) no-ops with `ok: true` (idempotent) when an open entry already links to the ticket — belt to the UI's braces.
4. **Say what happens next** (solution 2): under the `Queued` button (or replacing the bare check), a routine-aware one-liner; link "AI Queue" to the Overview so the user can see the entry landed. The routine on/off fact comes from the same preferences/routine state `RoutineWork.tsx` and the drain sweep already read.
5. **Tests:** detail read reports `queued` for a linked open entry (and not for a done one); double-queue is a no-op; TicketDetailPage renders Queued from the server fact; the hint flips on routine state.
6. **Close the loop:** comment on #1164 with what changed and close it (the ticket file is then removed).

## Considerations

- A hand-written queue entry that mentions the ticket mid-line must *not* count as queued — only a leading link does (same rule as `queueEntryLabel`).
- A `done` (checked-off) entry must not count: the ticket can legitimately be re-queued.
- The Overview polls; the ticket page polls every 10s — the seeded `queued` and the local optimistic flip need to merge (`queued || detail.queued`), not fight.
- Copy for the routine-off case should name the actual toggle/routine the project uses, not a generic "autonomous mode".
