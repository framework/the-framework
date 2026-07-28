The `definePreset` factory (#326/#330): turns a `PresetSpec` (name, template, optional `what` param meaning, label) into a `PresetDef` with resolved params and a `render(what?, ctx?)` function.

## TLDR

- `DEFAULT_WHAT` = `${{ tf.session_name || "entire codebase" }}` — the default target a preset runs against (#874): the launching session, falling back to the whole codebase when no session exists yet.
- Omitting `what` defines a **paramless** preset: the template renders verbatim (the prompt scopes itself); with `what`, `render` fills `${{ tf.params.what }}`, trimming the passed value and falling back to the rendered default when blank/omitted.
- `PresetRenderContext` (`session_name`, `settings`, `presets`) is all-optional; `settings` defaults to `{}` and `presets` to `presetContext()` so a template never throws.
- `defaultWhat(ctx)` is exported so callers that *label* a run (the CLI's log title) say the same thing the prompt targets.

## Decisions

- The default is itself a rendered template, not a plain string (#874): `${{ }}` was always JS-evaluated but the default was the one string that never went through the evaluator, so a `${{ }}` inside it reached the prompt as literal text; rendering it against the same context lets the default depend on the launching session.
- The default renders with an empty `params`: it can read the session, but not itself.
- One optional argument (`what`) replaced a second near-identical factory for paramless presets plus six hand-rolled presets using neither.
- `label` lives on the spec rather than in the dashboard package: it is the preset's user-facing name, and keeping it elsewhere meant name and label could only be kept in step by hand.
- `newSession` sits on the preset, not on the surface that fires it: always-run-in-own-session (#959) is a property of the work (repo work loses from a live session's transcript and would land on its branch), not of where the user clicked.
