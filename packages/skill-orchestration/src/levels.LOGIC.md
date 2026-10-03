What the person's subagent settings [1] are, with nothing that needs Node: the two levels a main agent [2] says a task is, what a level's setting names, and how many of one main agent's subagents [3] run at once when nobody said. The command reads and writes the settings (`settings.ts`, which hands all of this on); the package's Settings section in the dashboard (`../dashboard/`) shows them with these same definitions, so the two cannot disagree on a level or on the number at once when unset.

## Glossary

[1] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent [2] calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents [3] run at once.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.

## Business logic — TL;DR

- **The levels** - `simple` and `hard`, in that order; no other word is a level.
- **A level's setting** - a coding agent the runner can start and, optionally, a model; no model is that coding agent's own default.
- **The settings** - a setting for `simple`, one for `hard`, and `atOnce`, how many of one main agent's subagents run at once, each optional.
- **How many at once when unset** - 4.
