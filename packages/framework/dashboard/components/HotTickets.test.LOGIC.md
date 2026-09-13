What the tests cover, for the Overview's [1] "Hot tickets" card:

- **The empty card names its lanes** - with nothing hot it reads "Nothing in progress, queued, or high priority." rather than claiming no tickets exist.
- **Three lanes, and a click into the project** - tickets are grouped under "In progress", "AI Queue" and "High priority", and selecting a ticket opens its project.
- **The launcher is prefilled** - selecting a ticket leaves the draft "Work on tickets/<file>. Do not start any other ticket." for the launcher [3] to take; the draft names the ticket's file, not its title.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] launcher: the Start form on a project's own page.
