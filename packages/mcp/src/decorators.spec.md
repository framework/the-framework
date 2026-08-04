All `@gemstack/mcp` metadata decorators (`@Name`, `@Version`, `@Instructions`, `@Description`, tool annotations, resource annotations, `@Handle` for DI), written to `Reflect` metadata.

## Decisions

- **Metadata keys are `Symbol.for(...)`, not `Symbol(...)`.** A bundler can inline this module into the app entry while the runtime resolves a *second* copy from `node_modules`; with unique symbols the write and the read land on different keys and every `@Handle(...)` injection silently degrades to no DI. Global symbols make the two copies agree. (Same bug class as the package's other static-state singletons.)
- Tool annotations (`@IsReadOnly` / `@IsDestructive` / `@IsIdempotent` / `@IsOpenWorld`) each take an explicit value because `false` must be distinguishable from *omitted*.
- `@Audience` and `@Priority` validate at decoration time and throw immediately on bad input — a wrong annotation should fail the build, not ship.

## Facts

- Zero-argument `@Handle()` falls back to `design:paramtypes`, which requires `emitDecoratorMetadata` *and* a build tool that honors it — plain `tsc` does; esbuild/Vite typically do not.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
