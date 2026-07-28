The built-in framework presets — Vike (flagship) and Next.js — plus `FrameworkPresetRegistry`, which registers presets and selects one for a project.

## TLDR

- `vikePreset`: deps `vike`/`vike-react`/`vike-vue`/`vike-solid`; files `+Page.*` and `+config.*` (regex, any depth).
- `nextPreset`: dep `next`; files `next.config.*`, `app/**/page.*`, `app/layout.*`.
- `builtinFrameworkPresets()` returns `[vike, next]` — stable order, flagship first.
- `FrameworkPresetRegistry`: `get`/`all`/`add` (add replaces by name, chainable), `detect(signals)` (delegates to `detectFramework` over all registered), and `select(signals, fallback?)`.

## Decisions

- `select` guarantees a preset even for an empty/unrecognized project: detected one, else the explicit `fallback`, else the first-registered (flagship) preset — while the returned `detection` stays honest that nothing matched (`detection.preset` undefined); throws only when the registry is empty.
