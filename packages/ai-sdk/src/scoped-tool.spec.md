Scoped tools: collapse a discriminated union of capability branches into one flat function-call schema, with per-branch validation at dispatch.

## Problems

- Function-calling APIs do not reliably honor a top-level `oneOf` — so a union of branch schemas must flatten into a single object schema the model can actually fill.

## Decisions

- The flattened schema unions all branch properties; top-level `required` is the discriminator plus only the fields required by *every* allowed branch; per-branch requirements are enforced in code at dispatch. The first branch to declare a field owns its schema; fields not shared by all branches get an auto-appended "only for …" description note.
- An `allow` list is a runtime allowlist (for plan-gated capabilities) honored by both the advertised enum and the dispatch; discriminator collisions throw at build time.
- The tool's Zod schema is a pass-through placeholder — the wire schema is the hand-built JSON schema, and dispatch does the real per-branch parse.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
