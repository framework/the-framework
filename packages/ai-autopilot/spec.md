`@gemstack/ai-autopilot` — the orchestration engine on top of `@gemstack/ai-sdk`: multi-agent supervision, the bootstrap spine (scope → build → full-fledged loop → deploy), the semantic review loop, durable decisions, scale mode, domain presets, and the pluggable runner seam.

## TLDR

- **Policy, not mechanism** — the enforced boundary with ai-sdk: if a feature is just calling a primitive it stays in ai-sdk; autopilot earns its keep only as topology, control policy, and run lifecycle. Concretely, every stage that talks to a model is an *injected function*, so the whole package runs offline against stubs.
- The seed topology (`supervisor.ts` + `planner.ts` + `synthesizer.ts` + `pool.ts`): plan → dispatch subtasks to workers under bounded concurrency, an optional token budget, and per-subtask error isolation → synthesize. The budget is checked before each claim, so in-flight workers overshoot; planning and synthesis spend is *invisible to* (and thus unbounded by) the budget — their contracts return data, not usage. A worker that pauses becomes a failed subtask with an explanatory error: the seed runs autonomous workers only.
- Everything user-visible is **markdown data, not code**: nine built-in prompt bodies (`prompts/`) and five domain presets (`presets/`), parsed with ai-skills' manifest parser (the package's only use of that dependency) and shipped inside the npm package.
- Autopilot never appends framing to an agent's instructions — what you write is the whole system prompt.
- Map: `src/bootstrap/`, `src/loop/`, `src/decisions/`, `src/overview/`, `src/preset/`, `src/prompts/` (which also documents the top-level `prompts/` bodies — no spec.md may live *in* that directory, since every `.md` there is parsed as a prompt bundle at load time), `src/runner/`, `src/surface/`, `src/framework-detection/` (each with a spec), plus `presets/spec.md`.

## Decisions

- The single `.` export barrel is the whole public API; its long doc header is the package's de-facto architecture note.
- Two durable, human-editable markdown ledgers (`DECISIONS.md`, `CODE-OVERVIEW.md`) round-trip through fs slices that are subsets of the runner's fs — a booted sandbox session satisfies them directly.
- Deferred by design: durable pause/resume of supervised runs, other topologies, queue-backed execution.

## Facts

- How the product (`@gemstack/the-framework`) consumes this package: the Bootstrap spine, the loop engine, domain presets, serve check, runners, deploy targets, framework detection, and the event stream — but **not** the `Supervisor` class (it imports only the types and synthesizes fake supervisor events so build narration still renders), not the built-in prompt library, not the decisions ledger, and not scale mode. The product replaces the agent layer with its driver seam while keeping autopilot's control policy.
- `harness/webcontainer/` is an opt-in, non-hermetic browser harness proving the WebContainer runner end to end (needs network); it is not part of the test suite.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
