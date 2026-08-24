What the tests cover: the page reads every registered project's tickets and lists each project's under its own heading; opening a row identifies the ticket by its project and filename; a project with no tickets still offers its own "Update from GitHub" rather than being a dead end; with no project registered the page says so; and an import or update started inside one project's section reports that project as the one the agent runs in.

Sorting: the page keeps the order the tickets arrive in by default (newest first), sorting by priority puts the highest first and lands in the address, and a priority tie falls back to newest first rather than an arbitrary order.

Filtering: searching narrows the rows, updates the shown/total tally beside the page title, and writes the search into the address; mounting under an address that carries a filter starts filtered; clicking a row's topic adds that topic filter; clicking a row's claim marker narrows to claimed tickets. When filters hide everything, the page says how many tickets are hidden and clears them from right there — and does not offer the GitHub update, because those tickets exist and are merely filtered.

Grouping: the flat mode renders one cross-project list ordered across projects, with each row naming its project and no per-project update controls; opening a flat row still identifies its own project and file; and a flat row's start button runs the work agent in that row's own project, unattended, with the ticket named on it.

The page-wide queue-add button: every shown ticket is queued the way the ticket detail page queues one (title as the entry, ticket linked, priority picking the section) and no agent is started; after the click the button reads "Queued" and stays disabled until the shown set changes, when it arms again counting the new set; a ticket an open queue entry already links to is not queued twice, and a checked-off entry does not count as queued; claimed tickets are skipped, with the button's label counting only the unclaimed tickets it will add; and the button is absent when nothing is shown or every shown ticket is claimed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
