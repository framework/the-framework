The "about this agent [1]" strip behind the action bar's disclosure, always available: which coding agent [2] ran the agent, which model, and what it has spent so far, added up from the agent's events [3]. The branch, pull request and changes sit in the bar row right above and are not repeated here.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Which coding agent and model** - "Agent" names the coding agent the agent's opening event recorded, as "Claude Code" or "Codex" (every surface Claude runs on counts as Claude Code), or the recorded implementation name when no driver claims it, or "Agent" when none was recorded; "Model" is shown only when the event recorded one.
- **What it has spent** - the diary keeps one usage event per turn [4] the coding agent priced and one result per turn it answered, and no token counts. "Spent" is every priced turn added up, as dollars with two decimals, shown once one turn was priced; "Turns" is the number of answered turns, shown once there is one. No token or cache count is shown, because the diary holds none.
- **Nothing reported yet** - before the diary holds a priced or answered turn, the strip says "No spend reported yet".
