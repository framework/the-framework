reflect-metadata decorators for MCP authoring: server identity, descriptions, `@Handle` DI tokens, and MCP-spec tool/resource annotation hints, plus their reader functions.

## TLDR

- Server identity: `@Name`/`@Version`/`@Instructions` (read via `getServerMetadata`); `@Description` on tools/resources/prompts (read via `getDescription`).
- `@Handle(...tokens)` marks a method's parameters beyond the first as DI-resolved — one token (class, string, or symbol) per extra parameter; `@Handle()` with no args defers to `design:paramtypes`.
- Tool hints (`@IsReadOnly`, `@IsDestructive`, `@IsIdempotent`, `@IsOpenWorld`): advisory MCP-spec annotations clients use for auto-approval/batching/sandboxing decisions; each accepts an explicit boolean defaulting to `true` because both `true` and `false` are meaningful vs. omitted.
- Resource annotations: `@Audience(...roles)` (throws on zero roles), `@Priority(n)` (validated 0..1 at decoration time), `@LastModified(string | Date)` (Date serialized to ISO).
- `getToolAnnotations`/`getResourceAnnotations` return `undefined` when nothing is set, so listings omit the `annotations` key entirely.

## Problems

- Bundle-split metadata identity: a bundled app inlines a copy of this module (decorators run at class-definition time), while the runtime reads metadata through a second node_modules-resolved copy. With `Symbol(...)` those copies have distinct key identities — write under one, read under the other, get `undefined` — so every `@Handle(...)` injection silently fell back to no DI.

## Decisions

- All metadata keys use `Symbol.for('gemstack.mcp.*')` (process-global symbol registry) instead of `Symbol(...)`, so any number of bundled copies share one identity. Same class of bug fixed in router (#507) and the static-state-singleton audit (#498/#500–#506).

## Facts

- The `design:paramtypes` fallback for bare `@Handle()` requires `emitDecoratorMetadata: true` AND a build tool that honours it — plain `tsc` does; esbuild/Vite typically do not.
- Key namespace: `gemstack.mcp.{name,version,instructions,description,inject,readOnly,destructive,idempotent,openWorld,audience,priority,lastModified}`. `index.test.ts` pins `gemstack.mcp.inject` so refactors can't drift it.
