Framework detection: score a project's dependencies and marker files against framework presets, so a run can narrate what it is working in.

## Facts

- Deliberately trivial: dependencies weigh 2, files weigh 1, all scores are returned, and confidence is the raw score, not normalized. A new framework is a new preset, not a runtime fork.
- Selection falls back to the first registered preset (Vike, the flagship) so a run always has one to narrate.
- **Nothing in the engine branches on the result** — detection is narration only.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
