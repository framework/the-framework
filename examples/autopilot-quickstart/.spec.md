Private workspace package `@gemstack/example-autopilot-quickstart`: the runnable end-to-end quickstart for `@gemstack/ai-autopilot`, offline and deterministic via `AiFake` + `FakeRunner`.

## TLDR

- `src/` — the quickstart flow, CLI entry, and smoke test.
- `package.json` — `start` (`tsx src/main.ts`), `test` (compile to `dist-test`, then `node --test`), `typecheck`; depends on `@gemstack/ai-autopilot` + `@gemstack/ai-sdk` (workspace).
- `README.md` — run/test instructions and the "going real" path (swap `FakeRunner` for a real runner, drop the fake).
