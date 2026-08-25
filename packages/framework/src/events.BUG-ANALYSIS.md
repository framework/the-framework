# Bug analysis: packages/framework/src/events.ts

## Business logic (high-level)

This file is the vocabulary of the whole event stream: the `FrameworkEvent` union (session, driver, choice, handoff, usage, end, …) plus the small supporting types (`ChoiceRequest`, `ChoiceOption`, `ChoicePick`, `AutoMergeOutcome`, skip/withheld reasons) and one runtime helper, `pickedIds`. It is deliberately a leaf module: the modules that *decide* these outcomes import the types from here, never the reverse (stated in the comments for `AutoHandoffSkip`/`AutoMergeOutcome`). Per `events.SPEC.md`, every surface is a projection of this stream, so the contract here is completeness of the vocabulary rather than behavior.

Key invariants encoded in the types and doc comments, checked against the SPEC:

- `ChoiceRequest`: at least one option (documented, not enforced — enforcement would live in the emitter); `recommended` required for single-select, omitted for multi (again a documented contract, not a runtime check).
- `handoff-armed.merge` optional with "absent reads as off" semantics — matches SPEC's conservative-display rule.
- `AutoHandoffSkip` covers exactly the ten decline reasons listed in the SPEC (not-armed, branch-gone, no-commits, commit-failed, no-remote, already-open, already-landed, already-pushed, run-stopped, fake-run). Verified one-to-one against `events.SPEC.md` § "Every decline is reported" — no reason missing, none extra.
- `OnBeforeMergeableSkip` covers the five reasons the SPEC lists. Match confirmed.
- `MergeWithheldReason` covers the two SPEC reasons (not-ready-for-merge, session-todo-open). Match confirmed.
- `usage.costUsd` optional — matches SPEC "some drivers report tokens but no price".

Since the file is ~99% type declarations, the only reachable runtime surface is `pickedIds`. Failure modes for the types would be spec drift (a reason in the SPEC missing from the union or vice versa); none found.

## Functions (low-level)

- **`pickedIds(picked: string | readonly string[]): string[]`** — normalizes a gate resolution to a list of ids. `Array.isArray` narrows the readonly-array case and returns a fresh copy (`[...picked]` — good: callers can't mutate the original event payload). A string returns `[picked]` when truthy and `[]` for the empty string. Edge cases: empty array → `[]` (copy, fine); empty string → `[]` (deliberate per test "an empty answer yields nothing chosen"); the `picked as string` cast is safe because the array branch was excluded. No trap with array-like objects since the type restricts inputs. Verdict: correct.

- **Type-only exports** (`ChoiceOption`, `ChoiceRequest`, `ChoicePick`, `ChoiceBy`, `OnBeforeMergeableSkip`, `AutoHandoffSkip`, `MergeWithheldReason`, `AutoMergeOutcome`, `FrameworkEvent`): no runtime behavior. Cross-checked doc comments against `events.SPEC.md`; the union arms and their optionality (`stopped?`, `detail?`, `merge?`, `model?`, `sessionLink?`) all match the described semantics. The two `on-before-mergeable` arms and three `handoff` arms are discriminated correctly (no overlapping literal combinations). Verdict: correct.

## Bugs found

None found.
