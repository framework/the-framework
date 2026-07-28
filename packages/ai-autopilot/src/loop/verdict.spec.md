The verdict convention: parse a structured `{ blockers }` outcome out of a prompt's text so the loop can gate on what a review concluded, not just whether it ran.

## TLDR

- `Verdict` = `{ blockers: string[], notes? }`; empty `blockers` means passing.
- `parseVerdict(text)` — scans all fenced code blocks (any language tag) plus a trailing bare `{...}` fallback, and returns the *last* candidate that JSON-parses to an object with a `blockers` array; blockers are stringified/trimmed with empties dropped; result is frozen.
- `isPassing(verdict)` — true only for a present verdict with zero blockers; `undefined` is not passing.

## Decisions

- Last candidate wins so a later, corrected verdict in the same output beats an earlier draft.
- `parseVerdict` returns `undefined` (rather than a failing verdict) when no verdict is present, so callers can distinguish "did not report" from "not passing" — the engine treats no-verdict as passing for backward compatibility.
- Transport is text because prompts return text; the convention is to end output with a fenced ```json block holding `{ "blockers": [...] }`.

## Facts

- This answers the note left in the loop (#113): the v1 gate stopped only on execution failure; verdicts let it stop on the review's outcome. The `production-grade` checklist prompt returns one and bootstrap's full-fledged loop repeats until `blockers` is empty.
