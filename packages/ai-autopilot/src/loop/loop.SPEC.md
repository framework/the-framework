The loop engine: hand it the policy and the prompts, declare an event after the agent works, and it runs the matching chain of follow-up prompts and reports how each fared.

## TLDR

- An event's kind selects prompts from every matching loop, in order and without repeats; an event no loop covers simply does nothing.
- Each prompt runs its passes with a fresh context every time, re-deriving its answer rather than carrying state over — repetition with fresh eyes improves the result.
- By default the chain is fire-and-report: every prompt runs even after an earlier one fails. In gate mode the chain stops at the first prompt that does not pass.
- Passing means the final pass ran cleanly and any verdict it reported lists no blockers; a chain naming an unknown prompt counts as not passing instead of crashing, so it gates exactly like a failing one.
- Prompts can consult the ledger of past decisions, and progress observers are isolated so a buggy observer can never abort a run.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
