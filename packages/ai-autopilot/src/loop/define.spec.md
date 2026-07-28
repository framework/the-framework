Fail-fast validators that turn author-facing specs into frozen `LoopPrompt`/`Loop` values, plus the shared `LoopError`.

## TLDR

- `definePrompt(spec)` — requires a kebab-case `id` and a `run` function; `passes` defaults to 1 and must be a positive integer; returns a frozen object.
- `defineLoop(spec)` — normalizes `on` (single kind or list) to a trimmed, de-duped frozen array; requires ≥1 event kind and ≥1 prompt id in `run`.
- `LoopError` — thrown at definition time so malformed policy fails before anything runs; messages are prefixed `[ai-autopilot]`.

## Facts

- Kebab-case is enforced with `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` — the same convention used by preset names and prompt ids elsewhere in the package.
