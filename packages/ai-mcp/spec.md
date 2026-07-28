`@gemstack/ai-mcp` — the bridge between `@gemstack/ai-sdk` Agents and Model Context Protocol servers, in both directions: consume a remote MCP server's tools as Agent tools, or expose an Agent as an MCP server.

## TLDR

- `src/` — the whole implementation: `mcpClientTools` (client direction), `mcpServerFromAgent` (server direction), shared types, tests.
- `package.json` — v0.1.4, single `.` export from `dist/`; depends on `@gemstack/ai-sdk` + `zod`; `@modelcontextprotocol/sdk` is an *optional* peer (devDep for tests); Node >= 22.12.
- `README.md` — usage, options tables, and the "which MCP package do I use?" disambiguation (this = agent bridge; authoring servers from scratch = a standalone MCP framework).
- `CHANGELOG.md` — history incl. the live-streaming fix, connect-leak fix, and sync-return fix (mined into the src specs).
- `tsconfig.json` / `tsconfig.build.json` / `tsconfig.test.json` — typecheck / build-to-`dist` / compile-tests-to-`dist-test` configs; `npm test` compiles then runs `node --test` inside `dist-test`.

## Decisions

- Carved out of `@gemstack/ai-sdk`'s former `./mcp` subpath so the optional `@modelcontextprotocol/sdk` dependency is declared only by the package that actually needs it; the SDK is only ever loaded via dynamic `import()`.
- This package is the *agent bridge* axis only — it depends on `@gemstack/ai-sdk` and is useless without an Agent; hand-authored MCP servers belong to `@gemstack/mcp` instead. Both "produce an MCP server", from different inputs, by design.
