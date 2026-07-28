Pure, synchronous composition functions that merge `LoadedSkill`s into an agent's instructions, tools, and middleware, plus `surface()` for pre-compose inspection.

## TLDR

- `composeInstructions(base, skills)` — agent `base` first (authoritative identity), then each skill's non-empty body under a `# Skill: <name>` header, joined by blank lines; empty-body (tools-only) skills contribute nothing.
- `composeTools(own, skills)` — agent tools first and they win every name collision; a colliding skill tool is kept but renamed `<skill>__<tool>` (then `__2`, `__3`, … if still taken) — nothing is silently dropped.
- `composeMiddleware(own, skills)` — agent middleware first, then skill-contributed middleware; always returns a fresh array.
- `surface(skill)` / `surfaceAll(skills)` — report name, description, trigger, `instructionChars`, tool names, resource names without composing (the "surface-before-compose" half of the trust model).

## Decisions

- Collisions namespace rather than drop: the loader's namespacing is the backstop the agent's authority rests on (code comment).
- `sanitize()` constrains skill names to `[a-zA-Z0-9_-]` for provider tool-name rules (belt-and-braces: the manifest schema already enforces this charset).
- `renameTool()` shallow-clones the tool with a new `definition.name`, preserving `execute` and `modelOutput`.
