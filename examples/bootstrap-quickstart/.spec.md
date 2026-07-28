Private workspace package `@gemstack/example-bootstrap-quickstart`: the capstone for `@gemstack/ai-autopilot` — preset detection + Bootstrap (scope → build → full-fledged loop → deploy) + scale mode — offline by default, with a live variant.

## TLDR

- `src/` — offline capstone (`bootstrap.ts`), live twin (`live.ts`, #124), CLI entries, smoke test.
- `package.json` — `start` (offline, `tsx src/main.ts`), `start:live` (real model, `tsx src/main-live.ts`), `test` (compile to `dist-test` + `node --test`).
- `README.md` — maps the demo to the epic's issues (presets #115, Bootstrap #116, …) and documents the no-key offline run.
