The bridge between agents and the Model Context Protocol, in both directions: consume a remote MCP server's tools as agent tools, or expose an agent as an MCP server.

## TLDR

- Consuming: point it at a server — a URL, a command to spawn, or a client you already hold — and its tools become agent tools, schemas passed through untouched. It owns the connection's lifecycle only when it created it. A remote tool's progress streams into the agent's own update channel by default, so long tool calls narrate instead of going quiet.
- Exposing: an agent becomes an MCP server as one tool per agent tool, as one tool that runs the whole agent per call, or both. A tool that can only be resolved by a human in a browser cannot be exposed — a remote MCP caller has no browser to hand it to.
- The whole package exists so that agent applications that never touch MCP never pay for it: the protocol dependency is optional and loaded only on use. Authoring a full MCP server from scratch is the sibling `mcp` package's job — this one is only the bridge to and from an agent.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
