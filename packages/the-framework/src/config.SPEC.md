The per-repo run defaults, persisted in a small YAML file (`the-framework.yml`) so a project's way of being built — its preset, modes, and what happens when a session finishes — travels with the code instead of being retyped per run.

## TLDR

- One canonical key list drives parsing, layering and narration alike, so a new setting is declared once and flows through everywhere.
- A missing file yields nothing; a malformed one is a warning and nothing — a bad config must never fail a run; explicit flags override whatever the file says.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
