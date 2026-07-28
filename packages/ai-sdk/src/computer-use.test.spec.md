Tests for the computer-use executor (`computer-use/` — `executeComputerAction`, key normalization) against a mock Playwright-like `PageLike`.

## TLDR

- Key normalization: xdotool/Anthropic names map to Playwright names (`ctrl`→`Control`, `cmd`/`super`→`Meta`, `Return`→`Enter`, `Up`→`ArrowUp`, ...); chords normalize per segment (`ctrl+a`→`Control+a`); unknown/single-char keys pass through.
- Pointer actions move first then click; modifiers press down before and release after in reverse order, and are still released when the click throws; right/middle buttons and double/triple `clickCount` map through; `left_mouse_down`/`up` skip the move when no coordinate.
- Scroll converts direction+amount to wheel deltas via `SCROLL_PIXELS_PER_CLICK`, moves the cursor first, and honors modifier text (shift-scroll).
- `screenshot` returns `{ type: 'image', media_type: 'image/png', data: Uint8Array }`; `cursor_position` reads executor state without touching the page; `wait`/`hold_key` sleep for `duration` seconds.
- Errors never bubble: throws (including non-Error values) are wrapped as `{ type: 'error', text }`.
- Exhaustiveness check drives every `ComputerAction` variant through the dispatcher.
