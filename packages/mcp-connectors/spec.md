The connector contract for wiring external services (GitHub, Google Drive, …) into agents as MCP tools: a connector declares what it needs, an orchestrator supplies it later.

## TLDR

- Declare-needs / supply-later is the whole idea: a connector defines its identity, its authentication *requirement*, and its tools — and nothing else. It never reads environment variables, never performs OAuth, never touches a transport. That is what lets first-party and third-party connectors compose interchangeably.
- Mounting composes any number of connectors into one MCP server: the orchestrator resolves each connector's credential at call time, prefixes tool names with the connector's id so they can't collide (duplicates fail at mount, not at runtime), and merges each connector's usage instructions into the server's. The result is a server class — the host picks the transport, exactly as with any hand-authored server.
- Connector tools answer with slimmed, agent-relevant fields rather than raw API payloads — an agent's context is a budget, not a dumping ground. Expected failures (bad input, missing access) come back as readable error results, not exceptions.
- The first-party connectors ship as siblings: GitHub (repos, issues, pull requests, files; writing limited to commenting and opening issues) and Google Drive (browse, search, read — office files exported as plain text — plus folder creation and sharing; deleting only to trash, so nothing is unrecoverable).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
