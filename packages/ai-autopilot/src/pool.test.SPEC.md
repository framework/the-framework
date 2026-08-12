Covers the dispatch pool: everything runs and results keep their order, the concurrency cap holds, the stop signal halts new work (reading as completion when nothing was actually skipped), one item's failure surfaces without stranding its siblings, and an empty list is fine.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
