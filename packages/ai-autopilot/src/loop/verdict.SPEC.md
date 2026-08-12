The verdict convention: a prompt can end its answer with a structured list of blockers, so the loop gates on what a review concluded rather than only on whether it ran.

## TLDR

- A verdict is the list of concrete work still required; an empty list means passing.
- It is read out of the prompt's plain-text answer; when several candidates appear, the last one wins, so a corrected verdict beats an earlier draft.
- "No verdict" is distinct from "failing": prompts that never report one still gate on execution alone.

## Rationales

- The first version of the gate could only stop on a prompt crashing; a verdict lets it stop on the review's outcome — which is what bootstrap's finishing loop repeats against until nothing is left to fix.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
