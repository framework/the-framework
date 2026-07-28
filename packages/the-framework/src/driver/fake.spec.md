In-memory `Driver` for tests and `--fake` runs: never spawns a process, replays scripted turns deterministically, and emits the same `DriverEvent` shapes a real driver does.

## TLDR

- `FakeDriverOptions`: scripted `turns` (last one repeats when exhausted so a short script never starves a longer run) or a dynamic `respond(prompt, index)` (takes precedence); `files` pre-seed `readCode`; fixed `sessionId` (default `fake-session`).
- Each prompt records itself on `session.prompts` (for assertions), emits `start` / `action`s / `text` / `result`, and resolves the turn (with optional usage, #322).
- Honors abort signals by rejecting; `readCode` rejects for unknown paths.
