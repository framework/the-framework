What the tests cover: a ticket's filename maps to the plan file sitting beside it inside `tickets/` (`2026-07-20_do-the-thing.md` to `tickets/2026-07-20_do-the-thing.plan.md`); the page reads that path and renders the plan's markdown; a ticket with no plan says so instead of showing a blank page; a plan cut short by the read's length cap says its tail was truncated; a plan whose author is on record offers "Resume agent" and opening it selects that agent's session, an author still running is offered as "Open agent" instead, and a plan with no recorded author shows no such control.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
