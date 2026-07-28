Checks client-supplied tool/prompt arguments against the declared Zod schema, returning the parsed value on success or a formatted issue list on failure.

## TLDR

- Duck-types `safeParse` on the schema; a plain `{ shape }` that is not a real Zod schema passes through unchanged — advertising is best-effort for those, so checking is too.
- Success returns the PARSED data, so handlers see coerced values and undeclared keys stripped, never the raw payload.
- Failure message joins issues as `path: message; …`.

## Problems

- The low-level MCP `Server` validates only the request envelope — `arguments` is an open record on the wire — so without this, `handle()` received whatever the client sent regardless of the declared schema. Handlers are written against the declared types and interpolate values into URLs/paths, making an unchecked argument a real injection surface (e.g. `number: "../../../user/repos"` against `z.number()`); fixed in 0.4.0 and applied identically in `tools/call`, `prompts/get`, and `McpTestClient.callTool`.
