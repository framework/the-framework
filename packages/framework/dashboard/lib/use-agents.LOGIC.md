Keeps the selected project's [1] list of agents [2] — the ones running now and the ones already finished — current in the browser, so the sidebar's list of agents and the main pane both read one list that never disagrees with itself.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Polled every 2 seconds** - the list is read when the project is selected and re-read every 2 seconds after that, so an agent that starts, changes status or ends shows up within seconds without a reload. Selecting another project starts over on that project's list, and with no project selected nothing is read and the list is empty.
- **A read that fails changes nothing** - the last list stays on screen rather than blanking, and the next read a couple of seconds later usually succeeds; a daemon restart therefore does not empty the sidebar.
- **Refreshed on demand** - an action that changes the list, such as starting an agent, refreshes it at once instead of waiting for the next poll. The refresh is dropped if the project selection has changed since, so one project's agents can never land in another project's list.
- **"Not read yet" is distinguishable from "not there"** - the list carries whether a successful read has landed for the current project. That is what lets a link to an agent that no longer exists say so, instead of a bookmarked link flashing "gone" while its first read is still out.
