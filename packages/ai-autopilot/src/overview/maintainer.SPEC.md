Owns the overview's upkeep: holds the current map, regenerates it on demand, and — the point of scale mode — refreshes it only when a change is material, so the map does not churn on every commit.

## TLDR

- Every change runs through the material-change detector; immaterial ones are skipped and the map stays untouched.
- A material change triggers regeneration, which always sees the previous map (revise, don't rewrite) and is told why the refresh fired.
- The fresh map is saved whenever storage is configured, and an existing one can be loaded back at startup.
- Regeneration is a pluggable step — usually the AI agent — so the whole policy works and is tested without a live model.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
