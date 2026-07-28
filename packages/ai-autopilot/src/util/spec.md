Tiny shared utilities used across the package's engines.

## TLDR

- `emitter.ts` — `makeEmitter`: observer-isolation wrapper for optional `onEvent` callbacks (throw → logged and swallowed; absent → no-op), shared by supervisor, loop, bootstrap, and overview (+ `emitter.test.ts`).
