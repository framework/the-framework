# Bug analysis: packages/framework/src/presets.test.ts

## Business logic (high-level)

Pins the registry↔catalog agreement and materialization per `presets.test.SPEC.md`:

1. **Exact key set** — `deepEqual(Object.keys(PRESETS).sort(), [six stems])`. This is the tripwire the whole "one source of truth" design leans on: a stem dropped from either side (registry or catalog) changes the key set and fails. It genuinely can fail in both directions (extra key or missing key). Correct.
2. **Underscore stem** — `'security_audit' in PRESETS`, matching the `tf.presets` key prompts read. Redundant with test 1 but documents the intent.
3. **Paths** — `PRESET_DIR === '.the-framework/presets'` and `presetFilePath('maintainability')`. Pins the workspace-relative shape (a leading `/` or cwd sneaking in would fail).
4. **Materialization** — an in-memory `StoreFs` records `write`/`mkdir`; asserts the dir is created, every `PRESETS` entry is written byte-identical at `join('/repo', PRESET_DIR, name + '.md')`, and the `${{ tf.params.what }}` blank survives unrendered in `maintainability.md`.

Verification quality: the loop `for (const [name, text] of Object.entries(PRESETS))` compares against the same `PRESETS` the implementation writes from — self-referential, but the point of the test is the *wiring* (every entry lands, verbatim, at the right path), and the unrendered-blank assertion checks real content independently. The loop cannot pass vacuously because test 1 already proves `PRESETS` has six entries.

Async handling: `materializePresets` awaited; fake fs methods all async. No unawaited promises.

## Functions (low-level)

- **fake `StoreFs`** — `read` returns `''` (never used by the code under test), `exists` consults `written` (also unused), `mkdir` records into `dirs`. Adequate for the surface exercised.
- **Assertions** — `written.get(...)` compared with `assert.equal(..., text, `missing ${name}`)` — a missing write yields `undefined !== text` and fails with a useful message. Correct.
- The final `?.includes(...)` inside `assert.ok` would fail on a missing file (`undefined` is falsy). Correct.

## Bugs found

None found.
