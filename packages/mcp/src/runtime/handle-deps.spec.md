Runtime DI plumbing: construct tool/resource/prompt classes through the resolver, resolve `@Handle` method dependencies, and evaluate `shouldRegister` gating.

## TLDR

- `resolveOrConstruct(Ctor, resolver?)`: resolver gets first refusal. With `has()`: unowned tokens go straight to `new Ctor()`, owned tokens go through `resolve()` and a genuine construction failure propagates loudly. Without `has()` (legacy): a `resolve` throw or `undefined` silently falls back to `new Ctor()`.
- `resolveHandleDeps(instance, propertyKey, resolver?)`: resolves the deps a `@Handle`-decorated method requests beyond parameter 0 (reserved for input/params/args). Token sources in order: explicit `@Handle(T1, T2, …)`, else the `design:paramtypes` tail (indices 1+).
- `isRegistered(item)` / `filterRegistered(items)`: evaluate `shouldRegister?()` (absent hook = always registered; async hooks awaited, result coerced to boolean).

## Decisions

- Fail-loud contract for `@Handle`: deps requested but no resolver → error telling the user to pass `new MyServer({ resolver })` or `new McpTestClient(Server, { resolver })`; resolver throw → wrapped error with `{ cause }` chaining the original; resolver returning `undefined` → dedicated "never inject undefined" error. All errors name the member (`Class.method()`) and token.

## Facts

- The `design:paramtypes` fallback needs `emitDecoratorMetadata: true` AND a build tool that honours it — plain `tsc` does, esbuild/Vite typically do not; hence explicit tokens are "always reliable".
- Error messages are prefixed `[gemstack/mcp]`.
