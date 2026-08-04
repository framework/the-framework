The loop: an event-to-prompt-chain policy — the agent declares a semantic event ("major change", "new UI flow"), a loop maps that kind to an ordered chain of prompts, and the engine runs each for N fresh-context passes, gating on the verdict convention.

## TLDR

- Semantic, not command-driven and not run-on-every-change: the trigger is *declared* by the agent, never guessed by a heuristic (a classifier can sit in front later).
- **The verdict convention**: a prompt ends its output with a fenced JSON block holding `{ "blockers": [...] }`. Empty means passing; non-empty is the concrete work still required — the loop gates on *what a review concluded*, not on whether it ran. The parser scans candidates from the end (a later corrected block beats an earlier draft) and returns undefined when absent, so "did not report" is distinguishable from "not passing".
- Fresh-context passes: the engine builds a new context per pass and carries no state between passes; the prompt bridge builds a new agent per pass. Rationale: re-running the same prompt with reset context measurably improves results.

## Facts

- A deliberate asymmetry worth knowing: in the loop engine, **no verdict means passing** (the loop must not block on prompts never asked for a verdict); in bootstrap's checklist, no verdict means **not** passing (a checklist must not pass on silence). Same word, opposite defaults, both on purpose.
- Multiple loops matching one event concatenate their chains and de-dupe prompt ids; an unknown prompt id produces a non-passing outcome — deliberately the same as a throwing prompt.
- The verdict is parsed only from the final pass; passing `null` for the verdict parser disables verdict gating entirely (execution-only gate).
- Default loops (code-authored): major-change → review, code-quality, security; ui-flow → qa, ux; production-check → production-grade. The shipped domain presets define their own chains and are what the product actually uses.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
