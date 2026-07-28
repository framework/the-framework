Record/replay fixture I/O for evals (#A5 Phase 4) — one JSON file per case under `evals/__fixtures__/<suite>/<case>.json`, replayed via `AiFake.respondWithSequence` for zero-API regression tests.

## TLDR

- `EvalFixture` (version 1): `{ version, suite, case, input, recordedAt, steps: AiFakeStep[] }`.
- `stepsFromResponse(response)` — normalizes an `AgentResponse` to assistant-only `AiFakeStep`s: user/tool turns dropped (framework regenerates them during replay), multimodal content collapsed to concatenated text, `toolCalls` kept verbatim so multi-step tool loops replay deterministically.
- `readFixture()` — `null` on ENOENT (replay falls back to a live run with a stderr note); throws on JSON or version errors.
- `writeFixture()` — mkdir -p + pretty-printed 2-space JSON; `slugify()`/`fixturePath()` make filesystem-safe `<suite>/<case>` segments (non `[A-Za-z0-9._-]` → `-`, empty → `_`).

## Decisions

- The `version` field is enforced on read: a stale fixture forces a re-record instead of silently mis-replaying; corruption throws because it is not a passing case.
- Pretty-printed JSON keeps PR diffs readable as model output evolves.

## Facts

- Replay transport is text-only — image/document parts wouldn't replay meaningfully through the fake.
- The `--record`/`--replay` CLI wiring lives in the host (`pnpm rudder ai:eval`, in `@rudderjs/ai`); this module is just the format + I/O.
