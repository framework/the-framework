Action vocabulary and structural Playwright types for computer-use (#A7 Phase 1) — mirrors Anthropic's `computer_20250124` tool schema verbatim.

## TLDR

- `ComputerAction`: discriminated union of every `computer_20250124` action — `screenshot`, `cursor_position`, `wait`, `mouse_move`, left/right/middle/double/triple click, `left_mouse_down`/`up` (for drags), `type`, `key`, `hold_key`, `scroll`.
- `ComputerActionResult`: `image` (PNG `Uint8Array`) | `text` (one-line confirmation) | `error` (Playwright failure text → mapped to `is_error: true` tool-result).
- `ComputerExecutorState` + `makeExecutorState()`: per-run mutable cursor position — Playwright has no API to read the synthesized mouse position, so the executor tracks it to answer `cursor_position`.
- `PageLike`/`PageMouseLike`/`PageKeyboardLike`: structural subset of Playwright's `Page` so the SDK types the executor without depending on the `playwright` package.

## Decisions

- Schema mirrors Anthropic exactly because Claude is fine-tuned on this vocabulary: the tool factory maps 1:1 to the native `{ type: 'computer_20250124', ... }` block with zero translation, and future OpenAI/Google support would change only the provider adapter, not the schema or executor.
- `PageLike` is structural on purpose — apps install Playwright (300MB+ Chromium) themselves; `puppeteer-core` pages and hand-rolled test mocks also fit.

## Facts

- Coordinates are `[x, y]` viewport pixels, top-left origin; 1280×800 is Anthropic's suggested training-distribution viewport; bounds are NOT validated (Playwright clips to viewport edges).
- Modifier keys ride on the `text` field of click/scroll actions as a `+`-separated string (e.g. `'shift+ctrl'`); the executor maps xdotool names to Playwright names.
- Anthropic versions the schema with dated suffixes (`computer_20250124` → possible `computer_20260101`); unknown variants are a forward-compat hazard, not a bug.
- `scroll_amount` is in mouse-wheel "clicks" (~100px each).
