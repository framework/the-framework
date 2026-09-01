Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package
- A **library, not a skill**: read by code, never by an agent ⇒ no `SKILL.md`, no
  command, no `use-npm-skills` keyword. A skill must not import another skill's code; a
  library is what every skill imports.
- Named after the branch it owns: `@gemstack/agent-data`. `file-branch` and `data-branch`
  were considered and dropped — the branch is the thing, the package is its keeper.
- The git runner and the exclude rule live here, not in a skill: the file store is built on
  them, and a library never reaches up into a skill. `skill-branches` imports them like
  every other consumer.
- `.branches`, the checkouts directory, is this package's constant: the data branch's
  checkout sits beside the agents' checkouts under it. Dotted so that no `*` glob descends
  into N copies of the repository.

## The branch
- A branch of the project's own repository holding files nobody edits in a working tree —
  the way `gh-pages` holds a site. Pushed and pulled eagerly: every machine and cloud
  session sees the same files, and the code branches stay 100% code.
- **One shared branch, a path per skill** (`tickets/`, `TODO_AGENTS.md`, the caller's
  `agents/`), checked out once at `.branches/agent-data`. One branch per skill was
  considered and dropped: N checkouts per project, N sync errors to surface.
- Named `agent-data`: singular, like the skill names. Not `agents-data` — that branch
  existed, was deleted, and old builds still push to it; a name a ghost still writes to
  cannot be reused.
- The name is exported once, as `DATA_BRANCH`, over hardcoded copies: every skill already
  depends on this package.

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
