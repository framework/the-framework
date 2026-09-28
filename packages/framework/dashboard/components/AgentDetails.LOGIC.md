The "about this agent [1]" strip behind the action bar's disclosure, always available: which coding agent [2] ran the agent and which model, read off the agent's card [5], the model by the name its coding agent gives it, and what it has spent so far, added up from the agent's events [3]. The branch, pull request and changes sit in the bar row right above and are not repeated here.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[5] card: the agent's record as the daemon hands it to the dashboard with the project's list of agents; the tool that runs the agent writes on it the coding agent it ran and the model it ran it with: the full id the coding agent named once it started (`claude-opus-5-5`), or, for a coding agent that names none, the model it was given.

## Business logic — TL;DR

- **Which coding agent and model** - "Agent" names the coding agent the card [5] records, as "Claude Code" or "Codex" (every surface Claude runs on counts as Claude Code), or the recorded implementation name when no driver claims it; "Model" is the model the card records, named as its coding agent names it in the list the daemon asked it for (`opus` reads "Opus 5.5", and so does `claude-opus-5-5`, the full id `opus` runs today, `lib/models.ts`); a model the list does not hold, or a list not answered yet, is shown by what the card records (`fable`, `claude-opus-5`). Since the card keeps the full id that ran, an old agent's model is never named after the newer model an alias has moved on to. Each is shown only when the card records it, so neither is shown before the dashboard's list of agents holds the agent.
- **What it has spent** - the diary keeps one usage event per turn [4] the coding agent priced and one result per turn it answered, and no token counts. "Spent" is every priced turn added up, as dollars with two decimals, shown once one turn was priced; "Turns" is the number of answered turns, shown once there is one. No token or cache count is shown, because the diary holds none.
- **Nothing reported yet** - before the diary holds a priced or answered turn, the strip says "No spend reported yet".
