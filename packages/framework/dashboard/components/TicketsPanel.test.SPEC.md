What the tests cover: tickets render as one-line rows carrying what has already been done to them, with the summary left to the detail page; the row spells out its priority ("Priority: 8" rather than a bare number), lists its topics, shows a human-readable age, shows the effort and uncertainty a plan recorded, and keeps priority, age and the GitHub link in that order; the list renders in the order it is given rather than re-sorting behind the caller's back; and opening a row identifies the ticket by its filename.

The plan column links a planned ticket to its plan and starts an agent asked to create the plan file beside the ticket when there is none — attended, unlike the other actions. The start column starts an agent asked to work that one ticket and no other, unattended and with the ticket named on it. Both send exactly the wording the buttons stand for, with no second copy of the prompt hidden behind them.

Row controls do not double as navigation: starting work, filtering by a topic, filtering to claimed tickets, and following the GitHub link all leave the row unopened, while clicking the title opens it. A claimed ticket names its holder inline rather than only on hover.

"Update from GitHub" sends the update preset's own text — the same instruction the onboarding checklist sends under that label — unattended, and hands the user to the agent doing the update; a refused start says why and moves the user nowhere. A filled backlog offers the update beside a stamp saying when `tickets/` last caught up, admitting "No record of an import yet" when it does not know; the empty backlog offers exactly one update button and no stamp. A list emptied by filters says how many tickets are hidden and withholds the update, and a panel with no project renders nothing at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
