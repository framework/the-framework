Domain presets as code: load `{loops, prompts}` bundles from directories of markdown (or author them in code), with mode variants selected by frontmatter conditions, and composition so presets-of-presets falls out.

## TLDR

- A preset directory is `preset.md` (name/description/title, optional default event) + `loops/*.md` (event kind → prompt chain) + `prompts/*.md`. Missing subdirectories yield empty lists; a missing `preset.md` throws.
- **Mode variants, most-specific-wins**: a file's stem is its name up to the first dot, so `major-change.technical.md` is a variant of `major-change.md`. A variant lists `conditions` (modes) and is eligible only when *every* listed mode is active; among eligible siblings the one with the most conditions wins; the base file (zero conditions) is always the fallback. Applied only during preset loading.
- Composition concatenates loops (harmless — the engine de-dupes prompt ids), merges prompts by id later-wins, and takes the last declared default event.

## Facts

- Built-in presets resolve relative to the module file, which works from both the built and test output — and is why `presets/` must ship in the published package.
- Preset directories without a `preset.md` are skipped during multi-preset discovery, and results sort by directory name for a stable picker order.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
