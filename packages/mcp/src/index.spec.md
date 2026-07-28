Main package entry re-exporting the public authoring surface: core classes, decorators, DI resolver, OAuth 2.1, the `node:http` handler, test client, observer types, and the pure helpers `zodToJsonSchema`/`matchUriTemplate`.

## Facts

- A comment states the SDK-wiring primitives (`createSdkServer`, `startStdio`, `createWebRequestHandler`) live at `@gemstack/mcp/runtime` to keep `@modelcontextprotocol/sdk` out of the main boot path — note however that `createMcpHttpHandler`, exported here, statically imports `web-handler` → `sdk-server` → the SDK `Server` (only the HTTP transport class is lazily imported).
- `zodToJsonSchema` and `matchUriTemplate` are exported publicly (since 0.2.0) so inspectors/tooling can build on the core without internal access.
