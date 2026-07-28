The synthesize stage: `defaultSynthesize` (deterministic, no LLM) and `agentSynthesizer` (LLM combine).

## TLDR

- `defaultSynthesize`: successful results in plan order, trimmed, joined with blank lines; failures omitted; empty string when nothing succeeded. Deterministic and free.
- `agentSynthesizer(agent, opts)`: prompts with instructions (default: "combine … resolve overlaps and contradictions; do not just concatenate") + `# Task` + one `## <subtask description>` section per successful result; failed subtasks are never sent; falls back to `'(no successful worker results)'`.
