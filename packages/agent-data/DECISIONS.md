Non-obvious decisions only — the ones a rebuild from the `SPEC.md` files alone would get wrong. Each is dated and says who made it and where. Anything not listed is left to the implementer's judgment. Flag conflicts instead of silently deviating.

## The package

- **A library, not a skill.** A skill is read by the model, a library by code; this package has nothing to tell an agent, so no `SKILL.md`, no command, no `use-npm-skills` keyword. Skill status would also forbid the very import it exists for. *(2026-08-31, Rom and Suleiman on Discord; #1750)*
- **Every skill depends on it, no skill depends on another.** The file-store code left `skill-branches` for this: inside any one skill, every other skill would depend on that skill. Over: leaving it in `skill-branches` and letting `skill-tickets` import a skill, which is what #1749 shipped. *(2026-08-30, Rom on Discord: "a skill is a capability"; #1750)*
- **Named after the branch it owns.** `@gemstack/agent-data`, over `file-branch` and `data-branch`: the branch is the thing, the package is its keeper. *(2026-08-31, Rom and Suleiman on Discord)*
- **The git runner and the exclude rule ship here.** The file store is built on them, and a library must not reach up into a skill for its git; `skill-branches` imports them like every other consumer. *(2026-08-30, Suleiman, #1750 §2)*
- **`.branches` is this package's name.** The data branch's checkout sits beside the agents' checkouts under one directory, so the constant lives with the file store and the checkouts' package imports it. The directory is dotted so no `*` glob descends into N copies of the repository. *(2026-08-27, Suleiman, #1736 — `.branches/` and `agent-`, the skill's own names, no product name inside; 2026-08-28, #1739 — the data branch checked out beside the agents' checkouts)*

## The branch

- **A branch of the project's own repository, holding files nobody edits in a working tree, pushed and pulled eagerly.** The way `gh-pages` holds a site: every machine and cloud session sees the same files, and the code branches stay 100% code. *(2026-08-18, Rom, #1582)*
- **One shared branch, a path per skill.** `tickets/`, `TODO_AGENTS.md` and the caller's own `agents/` on one branch, checked out once at `.branches/agent-data`. Over: one branch per skill — N checkouts per project, N sync errors to surface. *(2026-08-30, Rom on Discord: "B is 10x cleaner, A is a mess")*
- **`agent-data`.** Singular, like the skill names. Not `agents-data`: that branch existed and was deleted, and old builds still push to it — a name a ghost still writes to cannot be reused. Not `ai-data`, the 08-30 pick. *(2026-08-31, Rom and Suleiman on Discord)*
- **The name is exported once, from here: `DATA_BRANCH`.** Over four hardcoded copies: every skill already depends on this package. *(2026-08-30, Suleiman, #1750 design points)*

## A write

- **Every write is one cycle — sync with origin, apply the change, commit, push — and a lost push re-applies the change on origin's fresher tip, never forces.** The change is handed over as a function that can run again (the intent), not as a commit. Two attempts; a push that still fails keeps the commit local and the next cycle carries it. A conflict resolves toward origin, because the checkout is nobody's working tree and the intent is re-applied on top. *(2026-08-29, Suleiman, #1748 — the contract every write to the branch goes through, stated for the tickets skill and kept when the code became this package)*
- **Two writers, one rule.** A long-lived process writes through the persistent checkout, serialized per branch; a command an agent runs in any clone writes one-shot through a throwaway worktree on origin's tip and pushes straight to the branch, never touching the persistent checkout, which is another process's. Over: the command joining the process's funnel (the chain lives in that process's memory) or writing inside the persistent checkout (its `git add -A` and reset would eat a second writer's files). *(2026-08-29, Suleiman, #1748)*
