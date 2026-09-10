Reads a project's tickets as the dashboard shows them: the rows the `tickets` skill [1] lists off the `agent-data` branch's [2] checkout [3] under `.branches/agent-data`, with the holder [4] of each claim [5] resolved against the project's own agents [6] so a claimed ticket links to the agent working it. It also reads one ticket with its whole markdown for the ticket's own page, whether the project has any ticket at all, and when the tickets last caught up with GitHub.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[4] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[5] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[7] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **The rows, holders resolved** - every ticket the `tickets` skill [1] lists for the project; when a ticket's claim [5] names the id of one of this project's agents [6], live or archived, the row also carries that agent's id and, once the agent has named its work, its session name [7], so the ticket links to the agent's page. A holder [4] the project has no record of, such as another machine's agent or the branch name of a cloud session [8], is shown as written. The project's agents are looked up once, and only when at least one ticket is claimed; when they cannot be read, every holder is shown as written.
- **One ticket for its own page** - a ticket by file name, with its entire markdown and its holder resolved the same way; a file name that names no ticket yields nothing.
- **Whether the project has any ticket** - a yes-or-no listing, which the onboarding checklist polls.
- **When the tickets last caught up with GitHub** - the record the `tickets` skill keeps of its last sync with GitHub, or nothing when no sync has ever been recorded.
