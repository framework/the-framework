`detectFramework` — deterministically scores every preset against a project's `FrameworkSignals` (dependencies + file paths) and returns the best match plus all scores.

## TLDR

- Weights: a matched dependency counts `DEP_WEIGHT` (2), a matched file pattern `FILE_WEIGHT` (1) — deps are the stronger signal.
- Accepts `dependencies` as a `name -> version` map or a bare name list; file patterns are `RegExp`s tested against the project's path list.
- Returns `FrameworkDetection`: winning `preset`/`framework` only when the top score > 0, `confidence` = winning score (0 when nothing matched), and every preset's `{ preset, score, reasons }` sorted highest-first so ties are inspectable.

## Decisions

- No built-in fallback: when nothing matches, `preset`/`framework` stay undefined and the *caller* decides the fallback (usually the flagship preset, see `FrameworkPresetRegistry.select`).
- `reasons` name the concrete matched signals (`dependency "vike"`, `file matching /…/`) for explainable detection.
