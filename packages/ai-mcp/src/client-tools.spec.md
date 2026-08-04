`mcpClientTools` — turn a remote MCP server's tools into `@gemstack/ai-sdk` agent tools.

## TLDR

- Accepts three transport shapes: a URL (streamable HTTP), a `{command, args, env, cwd}` stdio spawn, or an already-connected client (duck-typed on `callTool` + `listTools`).
- No schema conversion in either direction: the remote JSON Schema rides through untouched via `dynamicTool` (the Zod field is a `z.unknown()` placeholder).
- MCP content blocks are flattened to a string for the tool-result slot (text concatenated; images/resources become `[image: <mime>]` / `[resource: <uri>]`; errors get an `[error]` prefix).

## Decisions

- **Lifecycle ownership is the central rule**: the bridge disposes the client only when it created the connection; a caller-supplied client stays the caller's to close. The returned array's `close()` is non-enumerable so spreading tools into an agent's `tools()` doesn't iterate it.
- Streaming (default on) drains `onprogress` through a producer/consumer queue inside an async generator; the call's outcome is replayed only after the queue empties, guaranteeing every progress chunk lands **before** the tool result.

## Facts

- `connectOrClose` exists for an upstream SDK bug: the SDK doesn't clean up when `transport.start()` rejects, so a failed connect could leak a stdio subprocess or HTTP session per retry — the bridge closes both client *and* transport itself.
- If listing tools fails on an owned client, the client is closed before the error is rethrown.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
