Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in the LOGIC.md files; a choice made while implementing is the implementer's judgment,
not a decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## Asking the person
- A skill teaches the agent the `await-choices` block: `question`, one SKILL.md the agent
  picks by itself when a choice is the person's. Picked over the runner adding a line to
  every prompt (prompt text of the runner's own) and over a system prompt through the
  driver (Codex has none, and a hidden prompt comes back).
- An agent that has a tool of its own for asking the person uses it; the block is for an
  agent with none, as one a runner starts without a terminal. Picked over a mark the
  runner puts in the agent's environment: runner code, and a skill naming a runner.
