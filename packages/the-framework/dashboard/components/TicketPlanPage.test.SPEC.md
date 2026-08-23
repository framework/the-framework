What the tests cover: a ticket's filename maps to the plan file sitting beside it inside `tickets/` (`2026-07-20_do-the-thing.md` to `tickets/2026-07-20_do-the-thing.plan.md`); the page reads that path and renders the plan's markdown; a ticket with no plan says so instead of showing a blank page; and a plan cut short by the read's length cap says its tail was truncated.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
