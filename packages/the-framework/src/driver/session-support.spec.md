Small helpers every driver session needs but that are not agent-specific, extracted so a second driver reuses rather than copies them.

## TLDR

- `makeEmit(onEvent, agent)` — event emitter that never lets a throwing listener (e.g. a dashboard handler) abort the agent run; logs and swallows, naming the driver.
- `combineSignals` — the live AbortSignals for a prompt (session's + per-call, absent ones dropped).
- `combineFraming` — folds session framing and per-call system prompt into one blank-line-separated block.
- `readWorkspaceFile(cwd, path)` — the default `readCode` implementation (fs read relative to session cwd).
