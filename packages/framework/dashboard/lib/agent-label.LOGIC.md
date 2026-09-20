Decides what an agent [1] is called wherever the dashboard lists agents, from the first of three facts that describes it: what the agent was asked to do, then its branch, then the moment it started.

## Context

**User story**: the user scans a list of agents and tells the rows apart by their first line. Many agents record no request of their own — one launched from a command, or resumed outside the dashboard — so the line must still name something real about them rather than announce that there is no prompt and leave the row to be recognized by the small print beside it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **What the agent was asked to do** - the request the agent recorded, with surrounding whitespace removed, is the label; a request that is blank or only whitespace does not count.
- **Otherwise its branch** - the branch the agent's record carries, shown as it is with surrounding whitespace removed: an agent names its own work by naming its branch (`branches name` in the `branches` skill), so the branch is the name the agent gave itself, when it gave one.
- **Otherwise when it started** - an agent that nothing else describes is labeled with its start time, in the dashboard's short date and time wording (the rules are in `format-date.ts`). A date is a poor name but a real one, and it belongs on the line that identifies the row.
