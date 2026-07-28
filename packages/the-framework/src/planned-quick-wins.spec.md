Carries a plan's own verdict onto the agent queue (#1334): a ticket whose `.plan.md` header says `Effort: quick-win` and `Consensus: consensual` is queued for the drain to implement, with no agent turn spent deciding that a second time.

## TLDR

- `parsePlanVerdict` / `isAutoImplementable` — the pure policy: read two header keys, and authorise only when both are explicitly the permissive value.
- `parseTicketHeader` — the ticket's title, priority and open/closed state, as the queue line needs them.
- `insertQueueEntry` — place an entry under its `## Priority N` heading, creating the section in descending order when the file has none.
- `promotePlannedQuickWins` — the daemon-side pass: read `tickets/`, skip what is queued already, write, and commit path-scoped. Wired as `AutoPmDeps.promotePlans`, asked once per project per tick.

## Problems

- The autonomy chain had a gap: tickets arrived (#1208), plans costed them (#685), and the drain implemented what was queued (#855) — but nothing carried a plan's conclusion onto the queue, so a ticket the planner had already judged trivial waited for a triage run to read the same ticket and reach the same conclusion again.
- Placement is correctness, not tidiness: `parseTodoEntries` returns entries in file order and the drain takes the first, so an entry appended to the end of the file is the last thing that would ever be worked — the opposite of "autonomously work on quick-wins".
- `todoPriorityForTicket` mapped only the ticket format's *words*, while every real ticket writes a *number*, so every promoted entry would have landed at the default 5. Fixed in `tickets.ts` as part of this.

## Decisions

- No agent runs this. The plan already made the judgement; re-deriving it would spend a subscription turn to reproduce an answer written down in the repo, which is what #879 exists to avoid.
- The daemon writes, never the agent — the same rule `queue-promote.ts` states: runs stay sandboxed in their worktrees with no write access to the checkout.
- Fails closed, and demands both keys explicitly (the `quotaHeadroom` polarity, #879). A plan that forgot to say, or said something this version does not recognise, means a human decides rather than an agent starting.
- Only the header is parsed — everything above the first `##` — so a plan that *discusses* quick wins in its prose cannot declare itself one.
- The queue line is the ticket link and nothing else: the plan sitting beside the ticket is where the detail lives, and copying it into the queue would be a second thing to keep true.
- `blocked` separates an obstacle from an empty repo, because "no plan called its ticket a quick-win" is the ordinary state of a healthy project and would otherwise print on every tick forever.
- A dirty queue file stands the pass down entirely, as `promoteQueue` does: a human mid-edit outranks an unattended tidy-up, and the next tick retries.

## Facts

- Insertion is additive by construction, like `landPinnedEntry`: one line, never a reorder or a removal, so it composes with whatever else is mid-flight.
- Promotion happens *before* the tick reads the queue, so a plan that landed since the last tick is drained on this one rather than after another cooldown.
- A closed ticket, a missing ticket file, and an empty title are all skipped — none of them is work a queue line could describe.
- The commit message is `[The Framework] queue N planned quick-win(s)`, path-scoped to `TODO_AGENTS.md`.
