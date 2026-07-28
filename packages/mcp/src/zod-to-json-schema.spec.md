Converts a Zod object schema to the JSON Schema that MCP advertises for tool/prompt inputs and outputs, using Zod 4's native `z.toJSONSchema`.

## Decisions

- Converts with `io: 'input'` (tool/prompt parameters are request inputs) and `unrepresentable: 'any'` so types with no JSON Schema analogue (`z.date()`, `z.bigint()`) degrade to an open `{}` instead of throwing.
- An `override` upgrades `z.date()` → `{ type: 'string', format: 'date-time' }` (dates serialize to ISO strings on the wire); `z.bigint()` deliberately stays open — no single safe JSON representation, so no guessing.
- Strips the per-schema `$schema` dialect marker; any conversion failure (e.g. a non-Zod `{ shape }`) falls back to `{ type: 'object' }` so a tool always advertises *some* input shape.
- Zod is a hard dependency, so conversion is done natively with no framework coupling.
