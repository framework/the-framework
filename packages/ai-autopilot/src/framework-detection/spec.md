The framework-detection seam (#115): the engine stays framework-agnostic; a `FrameworkPreset` is a pure detector that identifies which framework a project is on — a new framework is a new preset, not a runtime fork.

## TLDR

- `types.ts` — preset/signals/detection type contracts.
- `define.ts` — `defineFrameworkPreset` validation (kebab-case name, required framework label) + freezing.
- `detect.ts` — deterministic scoring of presets against project deps/files (dep weight 2 > file weight 1), all scores returned for inspectability.
- `library.ts` — built-ins (Vike flagship, Next.js second) + `FrameworkPresetRegistry` with `select` (detected → fallback → flagship, so a run always has a preset).
- `index.ts` — barrel; `*.test.ts` mirror each module.

## Facts

- Vike is detected via the `vike`/`vike-react`/`vike-vue`/`vike-solid` deps and `+Page.*`/`+config.*` files; Next via the `next` dep and `next.config.*`/`app/**/page.*`/`app/layout.*` files.
- Detection is honest on fallback: `select` may hand back the flagship preset while `detection.preset` stays undefined and `confidence` 0.
