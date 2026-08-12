Scale mode: keeps CODE-OVERVIEW.md — a compact map of the codebase the agent reads first in a large repo — always current, by refreshing it only when a change is material.

## TLDR

- The map lets the agent stay oriented without re-scanning the whole tree and blowing its context budget; the hard part is not writing it once but keeping it current, because a stale map is worse than none.
- Every change the loop reports runs through a deterministic material-change detector: build-tooling changes, test-framework migrations, restructures, and changes sweeping several areas refresh the map; routine edits never do.
- The maintainer owns that policy; regeneration is done by an AI agent that reads the repository, always seeded with the previous map so it revises rather than rewrites.
- The map is a human-editable markdown file a person can hand-correct, and it persists on the host disk or inside a sandboxed session alike.
- Dropping the maintainer into the loop as a prompt is what makes the overview self-maintaining.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
