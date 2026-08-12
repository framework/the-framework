The maintenance sweep: a background job that keeps registered repos healthy by running the maintainability review on whatever new work each repo has grown since it was last reviewed.

## TLDR

- Each repo remembers its last-reviewed commit in a small local file, so a sweep only ever acts on commits added since then.
- A repo seen for the first time is baselined at its current state — its pre-existing history is never reviewed retroactively.
- A separate weekly schedule triggers a whole-codebase pass that ignores commits entirely, closing the gap baselining leaves for repos that adopted the tool late; the two schedules are stored side by side so neither resets the other.
- A review counts as done only when it succeeds, so failures are retried next sweep; a sweep can be capped to a few repos, reporting the rest as pending.

## Rationales

- The weekly interval is deliberately not a setting: the sweep only queues follow-up work on an idle machine, so being a little too eager costs a backlog entry, not money.
- Broken state (rewritten history, an unreadable timestamp) errs toward reviewing again rather than silently dropping the repo from the schedule forever.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
