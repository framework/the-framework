Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**: read by code, never by an agent ⇒ no `SKILL.md`, no command.
  A skill must not import another skill's code; a library is what every skill imports.
- Package name = branch name: `@gemstack/agent-data` manages the `agent-data` branch, so it
  is called the same.
- The code that runs git, and the code that makes git ignore `.branches/`, live in this
  package and not in a skill. A skill that needs them imports them from here; none keeps
  a copy of its own.
- `.branches/` holds every extra checkout of the project — each agent's, and the data
  branch's — so its name is defined here. It starts with a dot to keep tools' `*` patterns
  out of it: every checkout inside is a full copy of the repository.

## The branch
- A branch of the project's repository holds the data, like `gh-pages`; code branches hold
  only code. Pushed and pulled on every change, so every machine sees the same files.
- One branch for all skills, a folder or file each. Not one branch per skill: one more
  checkout and one more error to report, per skill.
- The branch name is written once, here, as `DATA_BRANCH`; every other package imports it.

## Flow: a write
Fetch what others pushed → make the change → commit → push. If the push is rejected
because someone pushed in between, start over on top of their changes.

- The change is a function, run again on the new files; never a force push. After two
  failed pushes the commit waits locally for the next write.
- On a conflict the remote version wins; the change runs again on top.
- Two writers. A long-running process writes in its own checkout, `.branches/agent-data`,
  one write at a time. A command an agent runs writes in a temporary copy of the branch,
  pushes, and deletes the copy; it never touches the process's checkout, whose next write
  would sweep up or wipe its files.
