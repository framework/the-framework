Priority: 4
Topics: [bug, agent-driver, branches]
GitHub: [#1746](https://github.com/framework/the-framework/issues/1746)

# An Actions agent is told two branch names

## TLDR

An agent on a GitHub Actions runner gets two branch names:

- `prompts/branch_yourself.md` tells it to `git checkout -b agent-<SESSION_NAME>` and commit there.
- The GitHub Actions driver asks the workflow to push to `claude/<session id>` (`agent-driver`'s `ActionsSession.runBranch`, default prefix `claude/`; `target-driver.ts` passes no `branchPrefix`) and dispatches every later turn from that branch.

So one run has an `agent-…` branch and a `claude/…` branch, which one carries the work depends on the workflow, and the reclaim in `@gemstack/skill-branches` only looks at `agent-*`. Local and cloud agents end on one `agent-<name>` branch; Actions agents don't.

Options: (a) pass `branchPrefix: 'agent-'` and have the workflow push the branch the agent created; (b) drop the branch instruction for Actions and let the workflow's branch be the one; (c) leave it and document it.

**Needs the maintainer's call before any code** — it is the naming convention users see in their branch list.

## Why it matters

Actions runs may leave work on a branch the reclaim never sees, and users see an inconsistent branch list.

## Source

Imported from GitHub issue [framework/the-framework#1746](https://github.com/framework/the-framework/issues/1746), created 2026-08-28. Found by the stranger review of the two packages (#1743, #1744 follow-ups).
