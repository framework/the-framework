Loads `DomainPreset`s from directories of `.md` files — the no-code, marketplace-shippable form — including the package's shipped built-ins, with mode-variant override resolution.

## TLDR

- `loadDomainPreset(dir, {modes})` — reads the required `<dir>/preset.md` manifest (name/description via `parseSkillManifest` from `@gemstack/ai-skills`; `metadata.title` → title, `metadata.event` → `defaultEvent`), then loads `loops/*.md` and `prompts/*.md` in parallel; throws `DomainPresetError` when `preset.md` is missing.
- `loadLoopsFrom(dir)` — each winning loop file needs `metadata.on` (kind or kinds) and `metadata.run` (list of prompt ids) → `defineLoop`; missing directory → `[]`.
- `loadPromptsIn(dir)` (internal; the public prompt loader is `loadPromptsFrom` in `prompts/`) — winners parsed with `parsePrompt`.
- Mode overrides: every `*.md` in a content directory becomes an `Entry` (`stemOf` + `readConditions` from frontmatter); `selectWinners(entries, modes)` keeps one file per stem, so e.g. `review.technical.md` replaces `review.md` when the `technical` mode is active.
- `builtinPresetsDir()` — the package's shipped `presets/` resolved via `import.meta.url` (two levels up from `dist/preset/load.js`, also correct for `dist-test/`).
- `softwareDevelopmentPreset()` — the shipped, stack-agnostic default (#243).
- `builtinDomainPresets()` / `loadDomainPresetsFrom(dir)` — enumerate presets: each immediate subdirectory holding a `preset.md`, sorted by directory name; manifest-less subdirectories skipped; missing root → `[]`.

## Facts

- Five presets ship today: software-development, web-development, data-science, product-management, biological-science; new built-ins are discovered automatically as their directories land (this is the set the CLI/UI picker enumerates).
- Directory layout: `preset.md` (required) + optional `loops/` and `prompts/` subdirectories; a missing subdirectory yields an empty list, so a preset can be loops-only or prompts-only.

## Flows

- `loadDomainPreset: readFile preset.md → parseSkillManifest → [loadLoopsFrom(loops/), loadPromptsIn(prompts/)] (each: readdir *.md → parse frontmatter → selectWinners(modes) → defineLoop/parsePrompt) → defineDomainPreset`
- `builtinDomainPresets: builtinPresetsDir → loadDomainPresetsFrom → per subdir hasManifest? loadDomainPreset`
