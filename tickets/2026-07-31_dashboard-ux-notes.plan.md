Effort: 2
Uncertainty: 5

# [Plan] Dashboard UX notes: rail width, Docs/History placement, inline choices, composer Stop/Resume

Plan for the one feature still open in #1455 — the launcher's tickets panel (items 5+11) — plus a close-out audit showing everything else in the ticket is already built on `main`.

## TLDR

Re-verified against `main` (2026-08-24): every item in this batch **except items 5+11** is built, including the ones the ticket's TLDR still lists as open — bonus 1 and bonus 2 landed in `OpenQuestions.tsx` (one scroll area + sticky jump-nav, answered gates collapsing to a line), the inline browser (item 6b) landed (`InlineBrowser`, `EventList`, `browser-stream.ts`), and the tinted-backgrounds note landed as the #1508 background wash (deliberately narrowed: wash on user turns / failures / clean finish only, per `EventList.SPEC.md` "if every row shouts, none does" — the maintainer's own example, finding user prompts, is covered).

The one remaining feature — the active project's tickets on the launcher (items 5+11) — is **blocked on a maintainer decision**, and not merely the Option A/B shape question the thread ends on: the maintainer earlier ruled the launcher tickets section *out* ("only one clear path", 2026-08-01), the first pass was removed on that call (`ProjectHome.tsx` comment), and the 2026-08-22 curated comment proposing to rebuild it (Option A vs B) has no answer yet. So the real question is three-way: Option A (short panel), Option B (collapsed full list), or Option C (stand by the removal and close the ticket). Implementation for A and B is trivial either way — `onTickets(projectId)` and `TicketsPanel`/`TicketRow` already exist.

## Problems

1. **Whether to build the launcher tickets panel at all** — the thread contradicts itself. 2026-08-01: maintainer agrees to *remove* tickets from the launcher ("users will most likely go to the tickets page anyways… better to have only one clear path"), and `ProjectHome.tsx`'s comment records the removal as the maintainer's call. 2026-08-22: the curated status comment re-frames items 5+11 as "the one remaining feature" and asks Option A vs B — unanswered as of today. An agent must not resolve this contradiction on its own; the newer comment is a proposal, not a decision. This is the whole of the Uncertainty rating.
2. **Shape, if built** — Option A (top few by priority + link to `/tickets`) vs Option B (full project list, collapsed by default). Genuine trade-off, explicitly left to the maintainer; the curator recommends A.

Neither problem is technical: for either option every building block exists (per-project read `onTickets`, row renderer `TicketRow`, the `ProjectHome` slot next to `ProjectDocs`, and `ProjectDocs` itself as the precedent for "don't dominate the page").

## Solutions

For problem 1 (three-way decision, needs the maintainer):
- **Option A — short panel** (curator's pick on the thread): a handful of top-priority tickets inline, `/tickets` link for the rest. Honors both sides: tickets return to the launcher (items 5+11) without recreating what got the first pass removed (67 tickets pushing everything below the fold). Consistent with the settled long-term direction ("main view = current info + high-level overview; details behind collapsibles or the rail").
- **Option B — full list, collapsed by default**: complete but heavier; one click from the exact page-domination problem, and duplicates the /tickets page behind a collapse.
- **Option C — won't-do**: stand by the 2026-08-01 "one clear path" call, close items 5+11, and close the ticket (everything else is built). Zero code; arguably what the maintainer already decided.

Recommendation: put A vs B vs C to the maintainer on issue #1455 (the thread is the de-facto design conversation); default to A if they defer, since it is their own framing's recommended shape and the thread's last word.

For problem 2: covered by the same question — no separate round-trip needed.

## Considerations

- **Everything else is built — verified, not from memory**: item 4 (`OpenQuestions.tsx`, mounted in `ProjectHome.tsx`), items 2/3 (`ProjectDocs` in the main column, `RightRail.docsInMain`; History removed outright with LOGS.md, #1536), item 6a (inline gates, `EventList`/`ChoicePanel`, PR #1482), item 6b (inline browser: `browser` event in `browser-stream.ts`, latest-row-hosts-the-pane in `EventList.tsx`, degrade-to-last-frame; rail Browser tab kept for v1 as agreed), item 7 (Choices rail tab gone), items 8/9 (composer Stop/Resume, `AgentComposer.tsx`), item 10 (`isMetaPublishing` requires `handoff?.push === true`), bonus 1 (#299 shape: one scroll area, sticky right jump-nav, no pagination), bonus 2 (`AnsweredChoice`, both in the transcript and the questions hub), colored badges (#1487) and background wash (#1508).
- **The tinted-backgrounds note is settled by design, not fully by letter**: the maintainer asked for slight background colors per kind; #1508 shipped the wash for exactly three row kinds and `EventList.SPEC.md` records the rationale. If the maintainer wants per-kind tinting beyond that, it is a new ticket, not this one — the SPEC decision would need revisiting.
- **Don't rebuild what TicketsPanel already solved**: claim markers, plan column, start-agent-from-row, empty-vs-filtered states all live in `TicketsPanel`/`TicketRow` (`TicketsPanel.SPEC.md`). Option A should reuse `TicketRow` (or a slimmed variant), not fork the row.
- **HotTickets is not a substitute**: the Overview's card is cross-project and lane-based (in-progress / queue / high-priority); items 5+11 ask for the *active project's* backlog on *its* launcher. But its "top few that matter" selection logic (`ticket-priority.ts`) is the natural sort for Option A's shortlist.
- **Where it goes**: `ProjectHome.tsx` column order is Actions → error banner → StartAgentForm → AgentOverview → OpenQuestions → ProjectDocs; the panel slots beside `ProjectDocs`, below OpenQuestions (open questions stay the launcher's main event).
- **The stale `ProjectHome.tsx` comment**: whatever is decided, the comment block recording "item 5 was REMOVED on the maintainer's call" must be updated to record the final decision, or it will mislead the next agent the way the ticket's TLDR now trails the code.
- **Ticket close-out**: once 5+11 is decided (built or won't-do), nothing in #1455 remains — remove the ticket, this plan, and the lock from `tickets/`, and update the GitHub issue.

## Implementation

Blocked first step — ask the maintainer on #1455: Option A, B, or stand by the removal (C)? Then:

**If A (default)**:
1. New `ProjectTickets.tsx` + SPEC + tests in `packages/framework/dashboard/components/`: poll `onTickets(projectId)` (same `usePolled` idiom as `ProjectDocs`/`OpenQuestions`), sort by the priority order `ticket-priority.ts` already defines, render the top ~5 as `TicketRow`s (no checkbox — the page has no bulk selection), header "Tickets · N open" linking to the /tickets page filtered to the project, footer "N more →" when truncated. Hide the section entirely when the project has no tickets (same rule as `OpenQuestions` — no empty noise on every launch).
2. Mount it in `ProjectHome.tsx` after `OpenQuestions`, and rewrite the removal comment to record the new decision.
3. Update `FEATURES-SPEC.md` (launcher gains a tickets shortlist) and the #1455 thread; then close out the ticket as above.

**If B**: same wiring, but render the full `TicketsPanel` inside a collapsed-by-default section (header shows the count; expanding reveals the panel). No truncation logic; steps 2–3 identical.

**If C**: no code; update the #1455 thread and close out the ticket. Optionally still fix the `ProjectHome.tsx` comment to say the decision is final.

Effort 2 either way (one small component + tests + SPEC + mounting); Uncertainty 5 solely because the build/shape decision is the maintainer's and the thread currently points both ways.
