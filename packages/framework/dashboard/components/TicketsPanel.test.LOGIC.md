What the tests cover:

- **A ticket as a one-liner** - the row shows the title, the claim marker with its holder inline, the topics, "Priority: 8" spelled out rather than a bare number, "Effort: 2" and "Uncertainty: 4" when the plan recorded them, and a readable age ("2d ago"); the ticket's summary is not on the row, it belongs to the ticket's own page.
- **Column order** - priority sits left of the age, the age left of the GitHub issue link.
- **The order of the rows** - the panel renders the tickets in the order it is given and never re-sorts behind its caller.
- **Opening a ticket** - clicking the title hands back the ticket's file name, the same name the ticket's own address uses.
- **The plan column when a plan exists** - a "View the plan for <title>" button opens that ticket's plan; there is no "planned" badge, the column says it; and no configure chevron, because reading a plan starts nothing.
- **The plan column when none exists** - "Create a plan for <title>" starts an agent with exactly the shared plan ask, "Create tickets/<stem>.plan.md", attended, and reports the started agent so the user can be taken to it.
- **The start column** - "Start work on <title>" starts an agent with exactly "Work on tickets/<file>. Do not start any other ticket.", unattended and with the ticket named as `tickets/<file>` so the daemon knows what is being implemented, and reports the started agent; starting does not also open the ticket.
- **Every control is beside the row, not inside it** - starting, selecting, clicking a topic and following the GitHub link never open the ticket; the GitHub link points at the issue's own address and shows its label.
- **Selection** - a row carries a "Select <title>" tick box only where the surrounding page acts on a selection, shows what the page says it is, and toggles by file name without opening the ticket.
- **Click-to-filter** - a topic badge hands its topic back, and the claim marker asks for the list to be narrowed to claimed tickets.
- **A claim naming one of the project's agents** - shows that agent's session name and opens that agent's page on click; a holder the project has no record of is shown exactly as the claim wrote it and opens nothing.
- **Importing from GitHub** - an empty `tickets/` offers "Update from GitHub" rather than a dead end, and a filled one offers the same button beside the stamp; both send the "Update tickets" preset's own text, unattended, and report the started agent so the user lands on it.
- **A refused import** - shows the daemon's reason ("already active") and moves the user nowhere.
- **The last-import stamp** - reads "Updated from GitHub 3h ago" when the project has one, and "No record of an import yet" when it does not, rather than inventing a date; the empty state carries the update button alone, with no stamp row.
- **"Configure first, then run"** - the start column's chevron opens this project's launcher with that ticket's work prompt waiting, the plan column's chevron with the plan ask, and the update's chevron with the update preset from either the filled or the empty state; none of them starts an agent.
- **Filtered down to nothing** - an empty list with hidden tickets reads "3 tickets hidden by the current filters" and offers no import, because those tickets already exist.
- **No project** - renders nothing at all.
