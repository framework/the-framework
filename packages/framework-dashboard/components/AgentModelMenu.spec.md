The agent + model picker as one dropdown tree (#650/#656/#658): top level lists coding agents, each agent's submenu lists only its own models.

## TLDR

- Picking a model fires `onChange(agent, model)` — both set together, so an incompatible pair (e.g. Codex + a Claude model) cannot be chosen.
- Trigger shows the current agent's logo (icon) then the current model's label; a tooltip spells out `Agent: … · Model: …` since the logo alone names the agent.
- `AgentOption.models[0]` is the agent's default; unknown agent/model values fall back to the first agent / the agent's default label.
- Pure presentational: agent/model data (`AgentOption[]`) and state come from the caller (Composer).
