The supervisor's internal dispatch pool: runs work items with a bounded number in flight, and an optional stop signal keeps new items from starting while letting in-flight ones finish.

## TLDR

- Results keep the plan's order; items skipped by the stop signal are simply absent, so fewer results than items is the truncation signal.
- The stop is only consulted while something is left to start — a budget met exactly by the final item reads as completion, not truncation, so callers never see a false "guardrail trimmed the plan".

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
