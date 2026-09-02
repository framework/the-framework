Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**. A skill is a `SKILL.md` an agent reads, plus a command it
  runs; this package has neither, because only code uses it. Skills never import each
  other's code; this library is what every skill imports.
- Package name = branch name: `@gemstack/agent-data` manages the `agent-data` branch, so it
  is called the same.
- The code that runs git, and the code that makes git ignore `.branches/`, live in this
  package and not in a skill. A skill that needs them imports them from here; none keeps
  a copy of its own.
- `.branches/` holds every extra checkout of the project — each agent's, and the data
  branch's — so its name is defined here. It starts with a dot to keep tools' `*` patterns
  out of it: every checkout inside is a full copy of the repository.

## The branch
- A branch of the project's repository holds the agents' data — tickets, the queue, the
  archives — like `gh-pages` holds a site; code branches hold only code. Pushed and
  pulled on every change, so every machine sees the same files.
- One branch for all skills, each with its own folder or file on it. Not one branch per
  skill: every extra branch would need its own checkout on disk and its own "could not
  sync" error in the dashboard.
- The branch name is written once, here, as `DATA_BRANCH`; every other package imports it.

## Flow: a write
Fetch what others pushed → make the change → commit → push. If the push is rejected
because someone pushed in between, start over on top of their changes.

- A write is handed over as a small function ("add this line"), not as a finished
  commit, so starting over is just running it again on the new files. Never a force
  push. After two failed pushes the commit waits locally for the next write.
- On a conflict the remote version wins; the change runs again on top.
- Two writers. A long-running process writes in its own checkout, `.branches/agent-data`,
  one write at a time. A command an agent runs writes in a temporary copy of the branch,
  pushes, and deletes the copy; it never touches the process's checkout, whose next write
  would sweep up or wipe its files.
