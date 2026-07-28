Domain presets — the Open Loop bundle unit (#204, #242): a `{loops, prompts}` bundle authored in code, loaded from a directory of `.md` files, or composed from other presets, with mode-conditional file variants (#244).

## TLDR

- `types.ts` — `DomainPreset` / spec / meta shapes.
- `define.ts` / `define.test.ts` — `defineDomainPreset` validation into frozen bundles; `DomainPresetError`.
- `compose.ts` / `compose.test.ts` — `composeDomainPresets` (loops concatenate, prompts merge later-wins, `defaultEvent` last-wins) + `selectPreset`; makes presets-of-presets fall out.
- `conditions.ts` / `conditions.test.ts` — pure mode-override resolution (`stemOf`, `readConditions`, `selectWinners`) for `foo.<mode>.md` variant files.
- `load.ts` / `load.test.ts` / `discover.test.ts` — directory loader (`preset.md` manifest + `loops/*.md` + `prompts/*.md`), shipped-preset discovery (`builtinPresetsDir`, `builtinDomainPresets`, `loadDomainPresetsFrom`), `softwareDevelopmentPreset` (#243).
- `software-development.test.ts` / `builtin-presets.test.ts` — shape guards for the five shipped presets under the package's `presets/` directory.
- `index.ts` — barrel.

## Facts

- Preset content is data, not code: manifests and bodies are `SKILL.md`-shaped markdown parsed with `@gemstack/ai-skills`' `parseSkillManifest`; loops come from `metadata.on`/`metadata.run`, prompts from the `prompts/` bundle format. This makes presets marketplace-shippable and community-editable.
- Shipped presets live in `packages/ai-autopilot/presets/<name>/` (software-development, web-development, data-science, product-management, biological-science), each with `preset.md`, `loops/`, `prompts/`; the `presets` directory is published via `package.json` `files`.
- Mode convention: `modes: ['technical']` (Technical Control) swaps in leaner loop variants; all shipped presets use `major-change` + `bug-fix` event kinds and give major-change review prompts a `{ "blockers" }` verdict footer so the loop gates.
