# Bug analysis: packages/framework/src/presets.ts

## Business logic (high-level)

The node-side join of registry and catalog (#326/#881): `PRESETS` (stem → template) derives from the catalog, and `materializePresets` writes each template to `<cwd>/.the-framework/presets/<stem>.md`. Per `presets.SPEC.md`:

- **One source of truth**: `PRESETS` maps `def.name.replace(/-/g, '_')` and filters to `PRESET_STEMS`. Verified against `preset-catalog.ts`: exactly six catalog rows survive the filter (`security-audit` → `security_audit`); the paramless presets (triage, drain-queue, etc.) are filtered out, which is intended — they never materialize. A stem missing from the catalog silently vanishes from the map, and `presets.test.ts`'s exact key-set assertion is the designed tripwire.
- **The blank ships unrendered**: templates are written verbatim (`def.template`, never `def.render(...)`), so `${{ tf.params.what }}` survives into the file — pinned by the test; the queue entry tells the agent what to substitute.
- **Overwrites on purpose**: `fs.write` truncates/replaces, so re-running install refreshes to the installed version. No delete-then-write window worth worrying about (a torn preset file is refreshed on the next materialize, and agents read it long after install).

Edge cases:

- `fs.mkdir(join(cwd, PRESET_DIR))` — `StoreFs.mkdir` (nodeStoreFs → nodeFs) is documented recursive, so a bare cwd without `.the-framework/` works. Verified in `node-fs.ts`.
- Sequential `await` in the write loop — six small files; no concurrency hazard.
- If two catalog rows ever mapped to the same stem, `Object.fromEntries` would keep the last silently; impossible with current names (all distinct after `-`→`_`). Noted as a reliance.
- The re-export block (line 9) keeps old import sites working — pure re-export, no drift risk since there is a single definition.

## Functions (low-level)

- **`PRESETS`** — `Object.fromEntries(Object.values(presets).map(...).filter(...))`. Templates for the two triage presets are wrapped (`triage(...)`) in the catalog but those rows are filtered out here anyway; `maintenance`'s template is the raw generated constant. Types: `Readonly<Record<string, string>>` — nothing mutates it. Correct.
- **`materializePresets(cwd, fs)`** — mkdir + write loop, default `nodeStoreFs()`. Absolute paths built with `join`, so Windows separators are fine on the fs side while the in-prompt references stay `/` (from `preset-registry.ts`). Errors propagate to the caller (install), which is right — a failed materialize should fail install loudly rather than leave dangling `filePath` references. Correct.

## Bugs found

None found.
