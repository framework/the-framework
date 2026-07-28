`scopedTool` / `capability` / `flattenCapabilities` — collapse a discriminated union of capability branches into ONE flat function-call tool with a discriminator enum, dispatching to the chosen branch's handler at call time.

## TLDR

- `flattenCapabilities(capabilities, discriminator='sub_tool', allow?)` computes a `FlatPlan` once (shared by schema render and runtime dispatch so they cannot drift): merged `properties`, top-level `required` = discriminator + intersection of all branches' requireds, `requiredByCapability` for in-code enforcement, `owners` per field.
- Non-universal fields get "Only for `<discriminator>`: a, b." appended to their description so the model knows scope; the discriminator property's enum lists allowed values with per-branch descriptions.
- `scopedTool(options)` returns a `ServerToolBuilder` whose definition uses `jsonSchema` directly with `inputSchema: z.unknown()` as placeholder — the loop's arg validation passes the raw object through; the dispatch validates discriminator against the allowlist, strips it, `safeParse`s the branch input, and runs the handler (plain async or async-generator via `yield*`).
- `allow` gates both the enum and runtime (per-plan feature gating); undeclared entries throw `ScopedToolError` at build time; collisions between a field/capability name and the discriminator throw too.

## Problems

- Function-calling APIs do not reliably honor a top-level `oneOf`, so a discriminated union must flatten to a single object schema with per-branch requireds enforced in code.

## Decisions

- First branch to declare a field owns its schema shape; later branches only record co-ownership (the model fills one flat object, so same-named fields must share a shape).
- Zod validation errors are rethrown as `ScopedToolError` with `path: message` pairs — a tool-level error the loop feeds back to the model, not a crash.
