Decides which framework a project is on by scoring every known preset against the project's dependencies and files and taking the best score.

## TLDR

- Deterministic and explainable: every preset's score comes back, along with the exact signals that matched, so ties are inspectable.
- When nothing matches, no framework is claimed — the caller decides the fallback.

## Rationales

- A matching dependency weighs twice a matching file: you install a framework on purpose, while a file can be a leftover.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
