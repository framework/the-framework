What the tests cover, for the Overview's [1] "Hot tickets" card:

- **The empty card names its lanes** - with nothing hot it reads "Nothing in progress, queued, or high priority." rather than claiming no tickets exist.
- **Three lanes, and a click into the project** - tickets are grouped under "In progress", "AI Queue" and "High priority", and selecting a ticket no agent [2] is implementing opens its project.
- **The implementing tag outranks the plan** - a ticket an agent is implementing right now reads "implementing" while a planned ticket beside it reads "planned"; a ticket being implemented with no plan at all still gets the "implementing" tag.
- **A ticket with an agent opens that agent** - selecting a ticket an agent is implementing opens that agent's page and not the project home; a ticket with no agent opens its project and no agent.
- **The launcher is prefilled** - selecting a ticket with no agent leaves the draft "Work on tickets/<file>. Do not start any other ticket." for the launcher [3] to take; the draft names the ticket's file, not its title; selecting a ticket that opens an agent leaves no draft behind.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] launcher: the Start form on a project's own page.
