The git status the dashboard shows for a checkout: which branch it is on, whether it has uncommitted changes, and the pull request linked to that branch.

## Business logic — TL;DR

- **Branch and dirty flag are the row; the pull request arrives when it can** - the two local git reads are fast and always answered, while the pull request lookup is an order of magnitude slower, so it is cached and allowed to arrive late rather than holding the row back on every poll.
- **Not knowing yet is not the same as having none** - while the pull request lookup is still running, the status says so explicitly, so the dashboard does not offer "Open PR" for a branch that already has one.
- **An agent's checkout gets the agent's own pull request** - when the status is read for an agent, the pull request is picked out of the branch's whole history: an open one, or a closed one no older than the agent itself.
- **Forgiving everywhere** - a path that is not a git checkout has no status at all; a failed status read counts as clean; a failed pull request lookup simply omits the pull request. This makes the status safe to read where there is no local checkout, such as over the relay.

## Business logic

### An agent's checkout gets the agent's own pull request

#### User story

An agent whose task pins its branch name — a routine that always works on the same branch — must not display the merged pull request a previous agent opened on that branch name as its own result.

#### Business logic

Read for a plain project, the status shows the newest pull request for the branch it is on. Read for an agent's checkout, the agent's start time is known, and the pull request is instead picked out of every pull request that branch name has ever had: an open pull request always counts, and a closed one only when it was created after the agent started.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
