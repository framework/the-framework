---
'@gemstack/mcp': patch
---

Validate tool and prompt arguments against the schema they declare.

A tool's `schema()` was only ever used to *advertise* its input shape in `tools/list`. The low-level MCP `Server` validates just the request envelope (`arguments` is an open record on the wire), so `tools/call` handed `handle()` whatever the client sent, regardless of the declared schema. Handlers are written against the declared types and interpolate those values into request paths, so an unchecked argument was a live injection surface: a tool declaring `number: z.number().int().positive()` and building `` `/repos/${owner}/${repo}/issues/${input.number}` `` would happily issue a request for `number: "../../../user/repos"` with the server's credentials.

`tools/call` and `prompts/get` now check arguments against the declared schema, reject a mismatch with a clear error, and pass the *parsed* value to the handler, so handlers see coerced values and undeclared keys stripped. Schemas that cannot validate (a plain `{ shape }` rather than a Zod schema) pass through as before. `McpTestClient.callTool` validates identically, so a test can no longer pass arguments a real client would be rejected for.
