The "about this agent [1]" strip behind the action bar's disclosure, always available: which coding agent [2] ran the agent, which model, and what it has spent so far, folded from the agent's events [3]. The branch, pull request and changes sit in the bar row right above and are not repeated here.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout.
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Which coding agent and model** - "Agent" names the coding agent the agent's opening event recorded, as "Claude Code" or "Codex" (every surface Claude runs on counts as Claude Code), or the recorded implementation name when no driver claims it, or "Agent" when none was recorded; "Model" is shown only when the event recorded one.
- **What it has spent** - from the latest usage event, which carries cumulative totals: "Spent" as dollars with two decimals when a cost is known; "Tokens" as "<input> in / <output> out"; "Cache" as "<read> read / <write> write" only when either is above zero; and "Turns", the number of turns [4] so far. Counts are compacted to one decimal with "k" past a thousand and "M" past a million.
- **Nothing reported yet** - before the agent reports any usage, the strip says "No spend reported yet".
