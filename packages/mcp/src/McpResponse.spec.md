Static factory helpers for building a tool's `McpToolResult`: `text()`, `json()` (pretty-printed 2-space JSON), and `error()`.

## Facts

- `error(message)` sets `isError: true` and prefixes the text with `Error: `; it is the preferred channel for expected, user-facing failures (validation, not-found) — the client sees a failed tool call rather than a thrown exception. Reserve throwing for unexpected faults.
