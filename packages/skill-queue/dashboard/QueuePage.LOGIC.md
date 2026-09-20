The Queue page: the open entries of the agent queue [1] of every project that has this package, in the order agents will take them, under the priority section each sits in.

## Context

**User story**: the user opens Queue and reads, per project, what agents will work on next and at what priority, as the file on the branch stands on this machine; a click on an entry that links out opens the link.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic

For each project the dashboard lists as having this package, the page asks the dashboard to run `queue --local --full` in that project: the open entries, each with the priority of the section it sits in, read from this machine's copy of the branch with no fetch, exactly what `npx queue --local --full` prints there. It reads again every 10 seconds. Until the first read has answered the page says "Loading…". Each project is its own section, headed by the project's name when the page lists more than one project. A project whose command fails, or prints something that is not a list, is named in red with the reason ("Could not read the queue of `<project>`: `<reason>`"), and the other projects still show; an entry the command printed in another shape than `{"entry", "priority"}` is left out. A project with no open entry says "Nothing queued."

Within a project the entries are grouped by priority, "Priority N" headers from the highest to the lowest, with the entries that sit in no priority section last under "No priority"; within a group the entries keep the file's order, the order of work. Each entry shows its label as `src/widget.ts` reads it: the text of a leading markdown link, else the whole entry; a leading link to an absolute http(s) URL is a link opening in a new tab, anything else plain text; the raw entry shows on hover. The page changes nothing: what is queued is changed by agents through the command, and by the "Add to queue" action on the dashboard's pages that show links.
