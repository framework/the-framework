A framework for authoring Model Context Protocol servers — tools, resources, and prompts declared as annotated classes, served over any transport, with no agent anywhere in sight.

## TLDR

- An author declares what the server offers: tool, resource, and prompt classes carrying their name, description, input schema, and behavioral annotations (read-only, destructive, idempotent, open-world), optionally constructed through the application's own dependency wiring — which fails loudly rather than injecting nothing.
- The runtime does the ceremony: validate the caller's input against the declared schema (handlers receive the cleaned, coerced result), invoke the handler, turn whatever it returns into a proper protocol result, and fan change notifications out to every connected session. A handler can also yield progress along the way, forwarded to callers who asked for it.
- Expected failures are answers, not crashes: a handler returns an error result the client can read; throwing is reserved for genuine faults.
- Transports are the server's choice, not the author's: an in-process test client (no transport at all — a server is testable the moment it compiles), stdio, or HTTP in any web framework — with sessions kept across requests or a fresh stateless exchange per request. Protecting a server is bring-your-own token verification plus standard OAuth 2.1 resource metadata; proxy headers are distrusted unless explicitly trusted.
- Agent-agnostic on principle: a server can expose anything — a database, files, weather. Bridging *agents* to MCP is the sibling `ai-mcp` package's job.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
