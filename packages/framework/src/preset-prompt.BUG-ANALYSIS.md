# Bug analysis: packages/framework/src/preset-prompt.ts

## Business logic (high-level)

Declares how a single preset is defined and rendered: a `PresetSpec` (name, template, optional `what` description, label, tooltip, `newAgent` flag) becomes a `PresetDef` with a `params` list and a `render` function. Invariants per `preset-prompt.SPEC.md`:

- A preset either takes exactly one target param (`what`) or is paramless, in which case the template *is* the prompt, returned verbatim (`render: () => template`).
- The default target `DEFAULT_WHAT` is itself a `${{ }}` template (`tf.session_name || "entire codebase"`), evaluated at render time against the same context as the body — the #874 regression fix (the default used to bypass the evaluator).
- An explicit `what` wins after trimming; blank/omitted falls back to the rendered default.
- Render context (`PresetRenderContext`) carries `session_name` and a `presets` stem→filePath map, defaulting to `presetContext()` so `tf.presets.<stem>.filePath` never throws.

Edge cases considered:

- **No session yet** (launcher preview): `session_name` undefined → `undefined || "entire codebase"` inside the fragment; the fragment result is the fallback string, never `undefined`, so `renderTemplate`'s undefined guard doesn't fire. Correct.
- **`what` containing `${{ ... }}` text**: the user value enters as *context data* (`params.what`), and `String.replace` with a function replacer does not re-scan inserted text (probed: `"a X b".replace(/X/g, () => "${{evil}}")` yields the literal). No template-injection / no double evaluation. Correct and important, since fragments are `new Function` code execution.
- **Paramless preset containing fragments**: `render()` returns the template verbatim, so a `${{ }}` would ship unrendered. Checked `prompts/presets/*.md`: only the six param-ful quality presets contain fragments; every paramless template is fragment-free, and the SPEC explicitly states "the template renders verbatim". Latent footgun if a paramless prompt ever grows a fragment, but not a bug today.
- **`defaultWhat` renders with `params: {}`**: a `DEFAULT_WHAT` referencing `tf.params.*` would throw — documented ("it can read the session, but not itself"); the shipped default doesn't.
- **`spec.what === ''`**: would be treated as param-ful with an empty description; no caller does this (catalog passes real strings). Reliance noted, not a bug.

## Functions (low-level)

- **`DEFAULT_WHAT`** — the template string. Contains no adjacent `}}` pair, so the fragment scanner's non-greedy rule is safe. Correct.
- **`tfFrom(ctx)`** — builds `{ session_name, presets }`; `presets` defaults to `presetContext()`. `session_name: ctx.session_name` may be an explicit `undefined` property, which is fine inside the evaluated expression (`tf.session_name` reads `undefined` either way). Correct.
- **`defaultWhat(ctx = {})`** — renders `DEFAULT_WHAT` with empty `params`. Exported so the CLI log title matches the prompt target (single source). Correct.
- **`definePreset(spec)`** — paramless branch keyed on `what === undefined`; param-ful branch builds the one `PresetParam` (default = `DEFAULT_WHAT`, unrendered — the launcher shows it as a template, pinned by the test) and `render(value, ctx)`: `value?.trim() || defaultWhat(ctx)` then `renderTemplate` with `params: { what: target }`. Whitespace-only value falls through `||` to the default (trimmed empty string is falsy). `render` for the paramless branch ignores any arguments passed — intended, the prompt scopes itself. Correct.

## Bugs found

None found.
