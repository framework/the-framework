Hook-runner helpers that execute an `AiMiddleware[]` chain for the agent loop, one function per hook family.

## TLDR

- Piped: `runOnConfig` (each transforms config, next sees result), `runOnChunk` (transform or drop via `null`, short-circuits once dropped).
- First-non-void-wins: `runOnBeforeToolCall` (returns skip/transformArgs/abort of the first middleware that answers).
- Sequential-await in declaration order: `runSequential` (dispatches `onStart`/`onIteration`/`onToolPhaseComplete`/`onFinish` by name), `runOnAfterToolCall`, `runOnUsage`, `runOnAbort`, `runOnError`.

## Facts

- `onConfig`/`onChunk` are sync; the rest are awaited — a middleware wanting async pre-model work must use `onStart` (this is why memory-inject runs there).
