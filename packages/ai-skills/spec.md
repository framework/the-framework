`@gemstack/ai-skills` — registry, loader, and composition runtime for **skills**: portable capability bundles (a folder with a `SKILL.md` manifest + instructions, optional compiled `tools` module, optional `resources/`) that compose onto an `@gemstack/ai-sdk` agent.

## TLDR

- A skill folder is `SKILL.md` (YAML frontmatter: `name`, `description`, optional `trigger`/`skip`/`appliesTo`/`metadata` + markdown instructions body), optionally `tools.js` exporting plain ai-sdk `tool()` objects, and a flat `resources/` directory.
- **Discover → load → compose**: `SkillRegistry.discover()` indexes only the cheap frontmatter of immediate subdirectories and never executes code; `loadSkill` loads the body and dynamically imports the tools module; `composeInstructions`/`composeTools`/`composeMiddleware` merge loaded skills onto an agent.
- `SkillfulAgent` is the declarative form: implement `baseInstructions()`/`skills()`/`baseTools()`, and the sealed `instructions()`/`tools()`/`middleware()` compose them — overriding the sealed ones directly silently drops skill composition (the documented trap).
- `surface()` reports what a skill would add (instruction size, tool names, resources) *before* attaching it.

## Decisions

- **Manifest = SKILL.md frontmatter, markdown-first** — not a TypeScript `defineSkill`. This keeps zero divergence from the `boost/skills` convention that shipped first inside ai-sdk, and mirrors the Anthropic Agent Skills shape: skills authored for Claude load here (the portability moat). Progressive disclosure falls out for free: index frontmatter, pay for body + tools only on load. Unknown frontmatter keys are allowed and dropped (forward compatibility), with `metadata` as the escape hatch.
- **Composition precedence is unambiguous: the agent is authoritative in all three dimensions.** Its instructions come first as the base identity; its own tools win every name collision (a colliding skill tool is renamed `<skill>__<tool>`, never dropped); its middleware runs first.
- **The trust boundary is stated, not sandboxed**: loading a skill runs its code, like installing a Vite/ESLint plugin. No in-process sandbox by design (Node `vm` is not a security boundary). The honest mitigations are implemented instead: explicit registration only (no implicit scanning), surface-before-compose (`loadTools: false` loads instructions without executing anything), and tool execution stays on ai-sdk's existing approval/middleware flow. Real isolation means OS/container isolation around the app.
- Tools reuse ai-sdk's `tool()` directly — one tool API across the framework. Accepted split: `SKILL.md` + resources are portable across agent runtimes; the typed tools module is the gemstack-specific binding.

## Facts

- The tools module is resolved as **compiled JS** (`tools.js`/`.mjs`/`.cjs`, never `.ts`); tool collection duck-types on `definition.name`, flattens arrays, and dedupes by identity so re-exports don't double-register.
- One malformed skill cannot break discovery of the rest (skipped, with an `onError` hook); duplicate names across scans: last wins, mirroring how registered sources layer.
- `trigger`/`skip` are data this package surfaces — trigger *matching* is the host application's job.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
