Playwright executor (#A7 Phase 1) — dispatches a `ComputerAction` against a `PageLike` and returns a `ComputerActionResult`; never throws.

## TLDR

- `executeComputerAction(page, action, state)` — exhaustive switch over the action union; all Playwright throws are caught and returned as `{ type: 'error', text }` so the agent loop forwards them as `is_error` tool-results and the model decides retry/recover/give-up.
- Modified clicks/scrolls: press modifier keys down, perform move+click/wheel in `try`, release in reverse order in `finally`.
- Key translation: `normalizeKey` maps Anthropic/xdotool names (`ctrl`, `cmd`, `Return`, `page_up`, …) to Playwright names (`Control`, `Meta`, `Enter`, `PageUp`); `normalizeChord` normalizes `+`-separated chords (Playwright parses chords natively); `parseModifiers` splits the modifier `text` field. Unmapped keys pass through verbatim.
- Exported constants: `SCROLL_PIXELS_PER_CLICK = 100` (one wheel "click" ≈ 100px), `MOUSE_MOVE_STEPS = 5` (interpolated move steps — slow enough for hover-driven UI to react).

## Decisions

- Failing the whole agent run on one missed click is too brittle — errors go back to the model as tool-results instead.
- A `never`-typed exhaustiveness guard makes TS error if a new `ComputerAction` variant lands without a handler.

## Facts

- `state.cursor` updates after every coordinate-targeting action; `cursor_position` answers from that state (Playwright cannot report the synthesized position).
- `wait`/`hold_key` durations are seconds (multiplied by 1000); clicks move the mouse first (with step interpolation), then click.
