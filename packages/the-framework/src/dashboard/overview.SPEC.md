The cross-project glance: what the agent is working on right now, how much is queued, which projects and agents were recently active, and which tickets are hot.

## Flows

- Active agents come from each project's live records — every concurrent one — most recently updated first; recent agents pool every project's history into one capped, newest-first rail.
- Hot tickets sort into three lanes with strict precedence: being worked on (a live agent is implementing it — hard evidence — or it has a plan), sitting in the AI queue, or merely flagged high priority; everything else stays off the card, which is a shortlist, not the backlog.
- "High priority" follows the ticket format's 0-10 scale (7 and up).
- The cross-project tickets page keeps one list per project, present even when empty, so importing stays reachable there.
- Forgiving throughout: an unreadable project contributes nothing.

## Rationales

- The priority floor reads the ticket format's own 0-10 scale, never the P-numbers convention: P-numbers put the most urgent work at the low numbers, so applying them here would keep a whole backlog of high-numbered urgent tickets off the card.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
