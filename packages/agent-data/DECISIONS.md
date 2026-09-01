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
