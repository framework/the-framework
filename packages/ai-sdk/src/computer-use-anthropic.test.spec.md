Tests for the Anthropic adapter's computer-use plumbing (`providers/anthropic.ts`) — `toAnthropicTools` providerHint substitution and `toAnthropicMessages` tool-result content shapes.

## TLDR

- A `providerHint: { type: 'computer-use' }` tool serializes to Anthropic's native block (`type: computer_20250124`, `display_width_px`/`display_height_px`, defaults 1280×800); custom viewports and future tool variants (e.g. `computer_20260101`) pass through; unknown hint types fall back to standard `input_schema` serialization; mixed computer-use + standard tools route independently.
- Tool messages become `role: 'user'` with a `tool_result` block: string content passes through, `ContentPart[]` images expand to base64 `image` source blocks (the computer-use screenshot path), mixed text+image keeps both parts, and non-string/non-array results are JSON-stringified (legacy fallback).
