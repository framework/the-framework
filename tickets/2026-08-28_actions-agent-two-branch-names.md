GitHub: [#1746](https://github.com/framework/the-framework/issues/1746)

# An Actions agent is told two branch names

## TLDR

An agent on a GitHub Actions runner gets two branch names. `prompts/branch_yourself.md` tells it to create `agent-<SESSION_NAME>` and commit there, while the Actions driver has the workflow push to `claude/<session id>` (`agent-driver`'s `ActionsSession.runBranch`, default prefix `claude/`; `target-driver.ts` passes no `branchPrefix`) and dispatches every later turn from that branch. Which one carries the work depends on the workflow, and `@gemstack/skill-branches`' reclaim only looks at `agent-*`. Local and cloud agents end on one `agent-<name>` branch.

Options: (a) pass `branchPrefix: 'agent-'` and have the workflow push the branch the agent created; (b) drop the branch instruction from `branch_yourself.md` for Actions and use the workflow's branch; (c) leave it as is and document it. **No code before the maintainer weighs in:** users see this naming convention in their branch list.

## Why it matters

Actions runs can leave their work on a branch the reclaim never looks at, and they are the one target whose branch names differ from the `agent-<name>` convention.

## Source

Imported from GitHub issue [framework/the-framework#1746](https://github.com/framework/the-framework/issues/1746), created 2026-08-28, no labels, 0 comments. Found by the stranger review of the two packages (#1743, #1744 follow-ups).
