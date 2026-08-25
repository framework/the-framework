What the tests cover: tickets render as one-line rows carrying what has already been done to them, with the summary left to the detail page; the row spells out its priority ("Priority: 8" rather than a bare number), lists its topics, shows a human-readable age, shows the effort and uncertainty a plan recorded, and keeps priority, age and the GitHub link in that order; the list renders in the order it is given rather than re-sorting behind the caller's back; and opening a row identifies the ticket by its filename.

The plan column links a planned ticket to its plan and starts an agent asked to create the plan file beside the ticket when there is none — attended, unlike the other actions. The start column starts an agent asked to work that one ticket and no other, unattended and with the ticket named on it. Both send exactly the wording the buttons stand for, with no second copy of the prompt hidden behind them.

Row controls do not double as navigation: starting work, filtering by a topic, filtering to claimed tickets, and following the GitHub link all leave the row unopened, while clicking the title opens it. A claimed ticket names its holder inline rather than only on hover.

Each of the three actions also offers "Configure first, then run": it opens this project's launcher carrying the prompt that action would have sent — the ticket's work ask, the ticket's plan ask, the update preset from either the filled or the empty backlog — and starts nothing. A plan that already exists is a link, so it has no chevron at all.

Rows carry a selection checkbox only when the surrounding page wires one: it shows the page's selection state, reports a toggle by the ticket's filename without opening the row, and is absent entirely on a page that selects nothing.

"Update from GitHub" sends the update preset's own text — the same instruction the onboarding checklist sends under that label — unattended, and hands the user to the agent doing the update; a refused start says why and moves the user nowhere. A filled backlog offers the update beside a stamp saying when `tickets/` last caught up, admitting "No record of an import yet" when it does not know; the empty backlog offers exactly one update button and no stamp. A list emptied by filters says how many tickets are hidden and withholds the update, and a panel with no project renders nothing at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
