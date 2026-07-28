Node-side join of the preset registry (stems) and catalog (templates): the `PRESETS` stem→template map and `materializePresets`, which writes the quality presets into a repo's `.the-framework/presets/`.

## TLDR

- `PRESETS` derives from the catalog (`presets` rows, hyphens→underscores) filtered to `PRESET_STEMS` — the only place registry and catalog meet.
- `materializePresets(cwd)` writes each preset to `<cwd>/.the-framework/presets/<name>.md` so an on-before-mergeable TODO entry's `filePath` resolves to a real file the agent can open (#326).
- Re-exports `PRESET_DIR`/`PRESET_STEMS`/`presetFilePath`/`presetContext` from `preset-registry.ts` (moved there in #874 for browser-safety) so existing import sites keep working.

## Decisions

- `PRESETS` is derived, not a second hand-maintained table re-binding the generated constants: previously a seventh preset was two edits with nothing checking they agreed; now a stem with no catalog row vanishes from the map, which the test's exact key-set assertion turns into a failure.
- Materialized files keep `${{ tf.params.what }}` unrendered: the TODO entry tells the agent what to set it to.
- Writes overwrite, so a re-install refreshes the files to the installed framework version (the package ships presets compiled, `files: ["dist"]` — they land on disk only via this write).
