Decides what an agent [1] is called wherever the dashboard lists agents, from the first of four facts that describes it: what the agent was asked to do, then the session name [2] its branch carries, then the branch itself, then the moment it started.

## Context

**User story**: the user scans a list of agents and tells the rows apart by their first line. Many agents record no request of their own — one launched from a preset, or resumed outside the dashboard — so the line must still name something real about them rather than announce that there is no prompt and leave the row to be recognized by the small print beside it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.

## Business logic — TL;DR

- **What the agent was asked to do** - the request the agent recorded, with surrounding whitespace removed, is the label; a request that is blank or only whitespace does not count.
- **Otherwise its session name** - the name the agent gave its own work, which is its branch minus the `agent-` prefix. A branch that is still the one the checkout [3] was created on, named after the agent id [4], is not a name the agent chose and does not count (the rule is in `branch-names.ts` of the `branches` skill).
- **Otherwise its branch** - a branch that carries no session name is shown as it is, with surrounding whitespace removed.
- **Otherwise when it started** - an agent that nothing else describes is labeled with its start time, in the dashboard's short date and time wording (the rules are in `format-date.ts`). A date is a poor name but a real one, and it belongs on the line that identifies the row.
