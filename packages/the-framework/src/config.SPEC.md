The per-repo run defaults, persisted in a small YAML file (`the-framework.yml`) so a project's way of being built — its preset, modes, and what happens when a session finishes — travels with the code instead of being retyped per run.

## TLDR

- One canonical key list drives parsing, layering and narration alike, so a new setting is declared once and flows through everywhere.
- Most keys are checked by type; the one whose values come from a closed set is checked by value instead, so a mistyped rung of the publish ladder is refused by name rather than silently ignored — a repo that meant "keep it local" must never end up publishing because of a typo.
- A missing file yields nothing; a malformed one is a warning and nothing — a bad config must never fail a run; explicit flags override whatever the file says.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
