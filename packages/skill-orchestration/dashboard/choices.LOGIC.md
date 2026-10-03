A level's menu in the Subagents section: what the person can pick for "Simple tasks" or "Hard tasks", and how a pick becomes a coding agent and a model. One choice is one coding agent and one model, since a model is always one coding agent's own.

## Business logic — TL;DR

- **The choices, in order** - "Same as the main agent" first, which leaves the level unset, so the subagent runs on the main agent's own coding agent and model; then, for each coding agent in the dashboard's own list (the launcher's, Claude Code then Codex), "<coding agent> · its own default", which names no model, followed by "<coding agent> · <model>" for each model that coding agent lists, by the name it gives it ("Claude Code · Opus 5.5").
- **A saved choice the lists do not hold** - kept at the end, so the menu shows what is in force: "<coding agent> · <model id>", or "· its own default" when it names no model; a coding agent the dashboard does not list is named by its id.
- **A choice and its setting** - "Same as the main agent" is no setting; a coding agent's own default is the coding agent alone; a model is the coding agent and that model.
