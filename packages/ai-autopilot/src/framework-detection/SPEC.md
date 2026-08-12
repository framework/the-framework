Works out which web framework a project is built on, so the autopilot can adapt to it while its engine stays framework-agnostic.

## TLDR

- A framework preset is a pure detector: a named framework plus the signals — dependencies and file patterns — that identify it in a project.
- Detection scores every preset against the project and picks the best; a matching dependency counts double a matching file, and the result is deterministic and explainable.
- Vike is the flagship preset and Next.js the second; supporting a new framework means adding a preset, never changing the engine.
- Selection always lands on some preset — the detected one, or the flagship as fallback — so a run is never without one, even on an empty project, while the detection result stays honest that nothing matched.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
