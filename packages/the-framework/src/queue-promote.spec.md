Queue promotion: copy exactly one file — `TODO_AGENTS.md` — off a finished run's branch into the project checkout, and the claim bookkeeping that stops two drains from double-assigning an entry.

## Problems

- Runs happen in a worktree, which is right for code and wrong for shared mutable state: a run that writes a good queue writes it onto a branch nobody reads, so the idle sweep re-derives the same entries every cooldown forever, spending real quota each time.

## Decisions

- The **daemon** does the promotion, not the agent — the agent stays sandboxed in its worktree with no write access to the user's checkout. The commit is scoped to that one pathspec.
- Conservative everywhere it is not certain: anything unexpected skips *with a reason* and leaves the checkout untouched. A skipped promotion costs one idle cycle; a wrong one touches a repo a human is working in.
- Retry-ability is a flag set by the failing step itself, never inferred by string-matching the prose reason.

## Facts

- Claims: an entry stays claimed while its run is live **or** its PR is open; a failed/stopped run or a closed PR releases it.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
