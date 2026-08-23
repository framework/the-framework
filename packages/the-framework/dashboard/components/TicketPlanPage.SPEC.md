One ticket's plan, rendered for reading: the `<ticket stem>.plan.md` file that sits beside the ticket inside `tickets/`, reached from the tickets list's plan link.

## Business logic — TL;DR

- **Addressed by the ticket it belongs to** - the plan is found from the ticket's own filename, so `2026-07-20_do-the-thing.md` shows `tickets/2026-07-20_do-the-thing.plan.md`; the page names that path in its header and offers a way back to the tickets list.
- **A plan is just a repo file** - it is read like any other file the dashboard previews, with the same guards against reading outside the repo and the same length cap; the page is re-read every ten seconds so a plan an agent is still writing keeps growing on screen.
- **No plan says so** - a ticket that was never planned, or whose plan has since been removed, gets a plain "This ticket has no plan yet." instead of an empty page.
- **A capped read admits it** - when the file was longer than the read allows, the page says the plan is truncated and that the rest is in the file, rather than letting the missing tail read as the end.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
