`computerUseTool({ page })` (#A7 Phase 2) — agent-tool factory wrapping the Playwright executor, tagged so the Anthropic adapter substitutes the native `computer_20250124` block.

## TLDR

- Construction: optional `model` check throws `ComputerUseProviderError` for non-Anthropic models; defaults — viewport 1280×800, `maxActions` 50, `needsApproval` true; fresh `ComputerExecutorState` unless `state` is supplied.
- `execute(action)`: bump closure-private counter (throw `ComputerUseLimitError` past the cap) → `executeComputerAction` → format: `image` → `ContentPart[]` with one base64 PNG block, `text` → plain string, `error` → throw (agent loop wraps as `is_error: true` so the model can retry).
- `COMPUTER_USE_MARKER = Symbol.for('rudderjs.ai.computer-use')` + `isComputerUseTool()` structural typeguard; tool name is fixed at `computer` (Claude is trained on that name).
- `definition.providerHint = { type: 'computer-use', tool: 'computer_20250124', display_width_px, display_height_px }` — carried via `toolToSchema` so `toAnthropicTools` emits the native block instead of a generic function-call schema.

## Decisions

- `inputSchema` is `z.any()` (and `toSchema()` emits an empty permissive object schema) — Anthropic's native block carries an implicit schema the model is trained on; the generic parameters only matter for non-Anthropic serializations, which in practice never run because of the constructor check.
- Cursor state and the action counter live in the factory closure: reusing one tool instance across runs SHARES them; call the factory inside `Agent.tools()` (run per request) for clean per-run state.
- `Symbol.for(...)` marker + structural guard mirrors the `HANDOFF_MARKER` pattern — cross-bundle/cross-realm detection without class coupling, surviving a double-loaded `@gemstack/ai-sdk`.
- Without `model`, validation defers: non-Anthropic models silently see a degraded no-arg generic tool rather than an error.

## Facts

- `viewport` must match what `page.setViewportSize(...)` was called with — Claude grounds click coordinates in the declared space.
- `needsApproval` wires through `ToolDefinitionOptions.needsApproval` (the standard approval-resume machinery); the function form gates per-action (e.g. free-run `screenshot`, gate destructive clicks).
- Base64 encoding prefers `Buffer`, with a `btoa` fallback that keeps the module importable from runtime-agnostic tests (execution itself is Node-only since Playwright requires it).
