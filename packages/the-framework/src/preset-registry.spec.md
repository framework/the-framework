Node-free registry of which presets materialize to disk and where (#326/#874): stems, paths, and the `tf.presets` context map, kept browser-safe so presets render in the dashboard (#520).

## TLDR

- `PRESET_STEMS`: the six stems that materialize (`maintainability`, `readability`, `security_audit`, `research`, `ux`, `maintenance`).
- `PRESET_DIR` = `.the-framework/presets`; `presetFilePath(name)` = `.the-framework/presets/<name>.md` (workspace-relative, because that is the agent's cwd).
- `presetContext()`: the `tf.presets` map prompts read — stem → `{ filePath }`.

## Decisions

- Stems only, no templates: the catalog (`preset-catalog.ts`) is the one table of presets, and this module sits *below* `preset-prompt.ts` (which reads `presetContext`) while the catalog sits above — importing the catalog from here would cycle. `presets.ts` joins the two on the node side.

## Facts

- The stem is both the on-disk name and the `tf.presets.<stem>` key: underscore file stem (`security_audit`), not the hyphenated run-kind name (`security-audit`).
