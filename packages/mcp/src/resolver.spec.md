The dependency-injection seam: the `McpResolver` interface adapting any container, plus the built-in Map-backed `createResolver()` for the no-container case.

## TLDR

- `McpResolver = { resolve(token), has?(token) }` — a one-function adapter over Awilix/tsyringe/InversifyJS/framework containers; supplied per-server at construction (`new Server({ resolver })`), never read off a global.
- `createResolver()` returns a chainable `MutableResolver`: `.register(token, instance)`; unregistered class tokens are constructed via `new Token()` as a convenience; unregistered string/symbol tokens throw (nothing to construct).
- `describeToken()` renders human-readable token labels (class name / symbol / quoted string) for error messages.

## Decisions

- The optional `has?(token)` hook (added 0.3.0): with it, the runtime routes only owned tokens through `resolve()` when constructing primitives, letting a genuine construction failure propagate instead of being masked by a silent `new Token()` fallback. Resolvers without `has` keep the legacy fallback behavior. The built-in resolver's `has` = registered OR any function (constructible class).
- Contract: a resolver must never silently inject `undefined` for a `@Handle` dependency — the runtime turns `undefined`/throws into loud errors naming the member and token.
