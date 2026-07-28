Source of `@gemstack/ai-skills`: load `SKILL.md` skill bundles (instructions + tools + resources) and compose them onto `@gemstack/ai-sdk` agents.

## TLDR

- `types.ts` — domain shapes (`SkillManifest`, `LoadedSkill`, `SkillSurface`, …).
- `manifest.ts` — parse + Zod-validate `SKILL.md` frontmatter/body; `SkillManifestError`.
- `loader.ts` — load a skill directory: manifest, `import()` of the compiled tools module, `resources/` listing.
- `registry.ts` — `SkillRegistry`: frontmatter-only discovery, cached on-demand load.
- `compose.ts` — merge skills into instructions/tools/middleware; `surface()` pre-compose inspection.
- `skillful-agent.ts` — `SkillfulAgent` base class sugar over the compose functions.
- `fs-utils.ts` — never-throwing stat helpers.
- `index.ts` — public exports.
- `*.test.ts` — `node:test` suites (compiled to `dist-test/` and run with `node --test`).

## Facts

- Pipeline: parse (manifest) → load (loader/registry, async) → compose (compose/skillful-agent, sync). Skills are therefore loaded ahead of time and composed synchronously.
- Trust model spans files: `discover()` reads only frontmatter and runs no code; `loadSkill()` executes the tools module's top-level code; `loadTools: false` + `surface()` allow inspection before trusting; tool execution still goes through the agent's normal approval/middleware flow. No in-process sandbox is pretended.
- Skill bundle layout: `SKILL.md` (required) + optional compiled `tools.js|mjs|cjs` + optional `resources/` dir.
- Agent authority invariant: the agent's own instructions come first, its tools win name collisions (skill tools get namespaced `<skill>__<tool>`), its middleware runs first.
