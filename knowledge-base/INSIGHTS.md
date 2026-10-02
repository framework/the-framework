# Insights

- The branches provider's `show` takes the commit to measure from as an optional
  argument and silently measures from the default branch when it is left out. Nothing
  fails: a run started from another branch is just credited that branch's commits. The
  run's page passed the run's `baseCommit` one pull request before the Human Queue did,
  so the same run read "1 commit" on one and "2 commits" on the other. Every reader of a
  run's branch passes the run's `baseCommit`, and a number shown on two surfaces is
  checked on both when how it is measured changes. (#1908, #1913)
- The faults of runs started from other runs showed only with real agents: the main
  agent's branch deleted once its subagent's branch was pushed, the chat's first part
  sent twice when a run was continued, the header counting another branch's files. Each
  package's tests passed, since each fault sat between two packages' rules. A change to
  branches, records or the live feed gets a hand test with a main agent and two
  subagents before it is called done. (#1907, #1908, #1909)
- A `DECISIONS.md` bullet that gives another package's behaviour as its reason goes
  stale when that behaviour changes: fixing the reclaim rule in `skill-branches` left
  `skill-orchestration`'s "Landing" bullet citing a bug that was gone. When a rule
  changes, search every package's `DECISIONS.md` for it, not only the one edited. (#1909, #1910)
- An agent set to update many `LOGIC.md` files emptied four of them in one commit, and
  nothing failed. After such a pass, compare each `LOGIC.md` on the branch with main's:
  one that got much shorter is a loss, not an edit. (#1907)
