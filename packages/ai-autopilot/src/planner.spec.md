`agentPlanner` — turn an ai-sdk `Agent` into a `Planner` that decomposes a task into a JSON array of subtasks.

## TLDR

- Prompt = instructions (default: "break into the smallest set of independent subtasks that can run in parallel") + `# Task` + `Output.array(...).toSystemPrompt()`; the response is parsed with `output.parse` (which tolerates fenced JSON).
- Element schema defaults to `{ description, worker? }`; override via `opts.element` (must produce at least `{ description: string }`) and `opts.instructions`.
