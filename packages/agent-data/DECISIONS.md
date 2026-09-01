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
Sync with origin → apply the change → commit → push; a lost push re-applies the change on
origin's fresher tip.

- The change is handed over as a **function that can run again** — the intent — never as
  a commit ⇒ a lost push is retried by re-running it on origin's tip, never by forcing.
  Two attempts; a push that still fails keeps the commit local, and the next cycle carries
  it out.
- A conflict resolves toward origin: the checkout is nobody's working tree, so origin wins
  and the intent is re-applied on top.
- **Two writers, one rule.** A long-lived process writes through the persistent checkout,
  serialized per branch. A command an agent runs in any clone writes one-shot through a
  throwaway worktree on origin's tip and pushes straight to the branch. Joining the
  process's cycle was rejected (the chain lives in that process's memory); writing inside
  the persistent checkout was rejected (its `git add -A` and reset would eat a second
  writer's files).
