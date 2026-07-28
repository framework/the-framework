`@gemstack/ai-skills` — portable capability bundles (Anthropic-Agent-Skills-style `SKILL.md` folders with instructions, tools, and resources) that compose onto `@gemstack/ai-sdk` agents.

## TLDR

- `src/` — the whole implementation: manifest parsing → loading/discovery → composition → `SkillfulAgent`.
- `README.md` — usage docs incl. the skill folder layout, the compiled-tools-module caveat, and the explicit trust model (loading a skill runs its code, like installing a Vite/ESLint plugin).
- `package.json` — ESM-only, Node >= 22.12, publishes `dist/` only; deps are just `@gemstack/ai-sdk` (workspace), `yaml`, `zod`.
- Tests compile via `tsconfig.test.json` into `dist-test/` and run with plain `node --test` (no test-runner dependency).

## Facts

- A skill authored for Claude (Anthropic Agent Skills) loads here and vice versa — the `SKILL.md` frontmatter shape is shared, also with `boost/skills` in `ai-sdk`.
- Only the typed tools module needs a build step; `SKILL.md` and `resources/` are portable as-is.
