Public types for `@gemstack/ai-mcp` (`StdioServerSpawn`, `McpClientTransport`, `McpClientToolsOptions`, `McpServerFromAgentOptions`), kept in a separate module so the client and server connectors share them without circular imports.

## Facts

- `McpClientTransport`'s already-connected-`Client` arm is typed as bare `object` on purpose: naming the SDK's `Client` type would force a hard dependency on `@modelcontextprotocol/sdk` at module load; the runtime narrows structurally instead.
- `StdioServerSpawn` mirrors the SDK's `StdioServerParameters` so consumers don't need a direct SDK import for the common spawn case; `env` defaults to inheriting the parent process env.
- Documented option defaults: `streaming: true`, `expose: 'tools'`, server name `${AgentClass.name}Server`, version `'1.0.0'`, `agentToolName` = agent class name.
