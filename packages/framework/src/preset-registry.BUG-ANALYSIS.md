# Bug analysis: packages/framework/src/preset-registry.ts

## Business logic (high-level)

The node-free registry of which presets materialize to disk (#326/#874): the six stems, the on-disk directory (`.the-framework/presets`), the stem→path helper, and the `tf.presets` context map. Split from `presets.ts` so the browser can render presets (#520) — verified: its only import is `framework-dir.ts`, which is itself node-free.

Key invariants, checked against the rest of the system:

- **Stems must match the catalog's names after `-`→`_`**: `PRESET_STEMS` = maintainability, readability, security_audit, research, ux, maintenance. Cross-checked `preset-catalog.ts`: the six param-ful presets are named `maintainability`, `readability`, `security-audit`, `research`, `ux`, `maintenance` — `security-audit` → `security_audit`, the rest map to themselves. The join in `presets.ts` therefore yields exactly these six keys, and `presets.test.ts`'s exact key-set assertion enforces the agreement in both directions (a stem with no catalog row vanishes from `PRESETS` and fails the test; a misspelled stem likewise).
- **The stem doubles as the template key** (`tf.presets.security_audit.filePath`): `prompts/presets/maintenance.md` references `tf.presets.maintainability.filePath` and `tf.presets.security_audit.filePath` — both present in `presetContext()`. Consistent.
- **Workspace-relative paths**: `presetFilePath` returns `.the-framework/presets/<name>.md` with no leading cwd — correct for the agent's cwd, and what the SPEC pins.

Edge cases: `presetFilePath` does not validate `name` (a `../` would traverse), but the only callers pass registry stems or catalog stems; the map built by `presetContext()` uses `PRESET_STEMS` only. Reliance noted; no hostile path can reach it.

## Functions (low-level)

- **`PRESET_STEMS`** — `as const` array of six stems. Underscore form, per SPEC. Correct.
- **`PRESET_DIR`** — `` `${THE_FRAMEWORK_DIR}/presets` `` = `.the-framework/presets`. Built with `/` (not `join`) — deliberate: this string renders inside prompts and must be forward-slash even on Windows; the node side joins it under a cwd via `join` where needed. Correct.
- **`presetFilePath(name)`** — string concat. Correct for its callers.
- **`presetContext()`** — `Object.fromEntries` over the stems; fresh object per call (no shared mutable state leaking into render contexts). Correct.

## Bugs found

None found.
