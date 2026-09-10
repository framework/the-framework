What the tests cover:

- **Where a plan lives** - a ticket's plan is the file beside it, its name with `.md` replaced by `.plan.md` (`2026-07-20_do-the-thing.md` reads `tickets/2026-07-20_do-the-thing.plan.md`), and the page reads exactly that path.
- **The plan itself** - the file's markdown is rendered, headings and prose alike.
- **A ticket with no plan** - reads "This ticket has no plan yet." rather than showing a blank page.
- **A plan cut short** - a read that was capped adds "Plan truncated — open the file to read the rest." rather than letting the tail read as empty.
- **The plan's author, finished** - a plan whose author is on record offers "Resume agent", and it opens that agent's page.
- **The plan's author, still writing** - an author that is still running is offered as "Open agent" instead, never as "Resume agent".
- **A plan nobody on record wrote** - shows the plan with no offer to open or resume any agent.
