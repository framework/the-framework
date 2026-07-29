Public API barrel of `@gemstack/the-framework` — re-exports the whole product surface and documents the package's thesis: wrap a coding-agent CLI as a black box and drive it from idea to running app.

## TLDR

- Pure re-export file; the doc comment is the package's front door: built on `@gemstack/ai-autopilot`'s spine, this package adds the two #166 pieces — the driver seam and the product shell (CLI + daemon + dashboard).
- Export groups: driver seam (`Driver`/`DriverSession`, Claude Code/fake drivers, `createDriver`), driver-backed bootstrap steps, run orchestration (`runFramework`, events, await gates), the store (`RunStore`, run meta, JSONL files), project/registry/install, presets + prompt templating + system prompt, daemon + control channel + auto-PM + todo loop, dashboard (`startDashboard` and its many projection types), quota/consumption guards, logs/conversations, CLI (`runCli`).

## Facts

- The driver-seam guardrail stated here: the seam is the code the agent produced, never the agent's tool calls.
- `system-prompt-file.js` is split from `system-prompt.js` so the pure composition stays browser-safe (#520); re-exported here so the entry's surface is unchanged.
