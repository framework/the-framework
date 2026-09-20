What the tests cover:

- **Where a plan lives** - the page reads the ticket with `tickets show <file> --local` in its project, whose answer carries the plan, and names the plan's path beside the way back (`2026-07-20_do-the-thing.md` reads `tickets/2026-07-20_do-the-thing.plan.md`).
- **The plan itself** - the file's markdown is rendered, headings and prose alike.
- **A ticket with no plan** - reads "This ticket has no plan yet." rather than showing a blank page.
- **The plan's author, finished** - a plan whose author is among the project's runs (the newest whose ask named the plan) offers "Resume agent", and it opens that run's page.
- **The plan's author, still writing** - an author that is still running is offered as "Open agent" instead, never as "Resume agent".
- **A plan nobody on record wrote** - a run whose ask named something else is not the author: the plan shows with no offer to open or resume any agent.
- **Back** - "Tickets" opens the widget's list page.
