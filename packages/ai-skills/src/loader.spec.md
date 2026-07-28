Loads a skill bundle from a directory: parses `SKILL.md`, dynamically imports the co-located tools module, and lists `resources/` files.

## TLDR

- `loadSkill(dir, opts)` — reads `<dir>/SKILL.md` (unreadable → `SkillManifestError`, ENOENT gets the message `no SKILL.md found in <dir>`), parses manifest + instructions, gathers tools and resources, returns a `LoadedSkill` carrying `dir`.
- Tools: first existing of `tools.js` / `tools.mjs` / `tools.cjs` (or `opts.toolsFile` override) is `import()`ed via `pathToFileURL`; module exports shaped like ai-sdk tools are collected, arrays flattened (`export default [a, b]` works), deduped by object identity so a tool exported both named and via a default array counts once.
- `opts.loadTools: false` — skip importing the tools module entirely (instructions + resources only), for surface-before-compose inspection of untrusted skills.
- Resources: files directly under `<dir>/resources/` (non-recursive), sorted by `localeCompare` on name.
- `loadSkills(dirs, opts)` — `Promise.all`, order-preserving, rejects on the first failure (use `loadSkill` + `allSettled` for partial tolerance).

## Decisions

- Loading is an explicit trust action: with `loadTools` on (default), importing the tools module runs its top-level code — documented in the README trust model.
- Only compiled tool modules resolve (`.js`/`.mjs`/`.cjs`, never `tools.ts`): a runtime `import()` needs built output; skills author in TS but ship the compiled file.
- Tools are detected by duck typing (`value.definition.name` is a string) rather than instanceof, so plain-object tools from any build/package instance load.
