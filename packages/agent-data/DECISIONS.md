Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- **A library, not a skill.** There is no `SKILL.md` and no command. Only code imports this
  package. Skills don't import each other's code; this is the shared library they all use.
- **Package name = branch name.** `@gemstack/agent-data` manages the `agent-data` branch, so
  they share the name.
- **`.branches/` holds every extra checkout.** Agent checkouts and the data-branch checkout
  alike, so the directory name is defined here. The leading dot keeps tools' `*` patterns
  from matching it. Every checkout inside is a full working copy of the project. It is
  hidden through git's exclude file, never a committed `.gitignore`: the library does not
  modify the project's files.

## The branch
- The project's repository has one branch for agent data: tickets, the queue. Code
  branches hold code only. Pushed and pulled on every change, so all machines see the
  same data.
- One data branch for all skills, each with its own folder or file on it. Not a branch
  per skill: each additional branch would need another checkout and another sync failure
  to report.
- A branch that does not exist yet is created as an orphan branch: no code commit is ever
  part of its history.
- The branch name is defined once, as `DATA_BRANCH`; every other package imports it.

## Flow: a write
Fetch → make the change → commit → push. If the push is rejected because another writer
pushed first, fetch again and retry on top of their changes.

- A write is a small function such as "add this line", not a pre-built commit. Retrying is
  running the function again against the new files. Never a force push.
- After two failed pushes the write reports the failure and the commit stays local. A later
  write carries it if it still applies cleanly on top of the remote; if not, it is
  discarded and only the current write runs. The remote wins, and nobody is told.
- Two writers. The long-running process that starts agents writes in its own checkout,
  `.branches/agent-data`, one write at a time. An agent command writes in a temporary
  checkout, pushes, and removes it. It never touches the process's checkout: the next
  process write commits whatever is there, and resets the checkout when it fails.
- An agent command whose write cannot be pushed fails. Nothing is queued for later.
