Connects scale mode to the real world: an AI agent regenerates the overview by reading the repository, and a loop prompt lets the overview maintain itself as the loop reports changes.

## TLDR

- The regeneration agent reads the tree and produces a fresh overview, always seeded with the previous one so it revises rather than rewrites blind — a stale or bloated overview is worse than none.
- The loop wiring hands each change to the maintainer, which refreshes only when the change is material, and reports back whether the map was refreshed or left alone.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
