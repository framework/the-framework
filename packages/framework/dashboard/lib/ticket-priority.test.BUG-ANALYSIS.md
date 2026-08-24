# Bug analysis: packages/framework/dashboard/lib/ticket-priority.test.ts

## Business logic (high-level)

Pins the shared priority reading: numeric parse (`'7'`, `'0'` — the zero case matters, it must not read as falsy-absent), undefined for absent and for a word (`'urgent'`), and the tone ladder at its exact boundaries (10/8 danger, 7/5 warning, 4/0 muted, absent muted). The boundary values 8 and 5 are each tested from both sides, so an off-by-one in either threshold fails a test. Assertions are exact; nothing vacuous.

Gap (noted, not a bug): no test for `parseInt`'s tolerant prefixes (`'7.5'`, `'10x'`) — the source's accepted leniency is unpinned either way.

## Functions (low-level)

- "parses a numeric priority string" — 7 and 0. Correct.
- "absent or unparseable is undefined, not NaN" — `toBe(undefined)` would fail on NaN (NaN !== undefined). Correct.
- "tone reads red past 8, amber past 5, muted below and when absent" — seven-point boundary sweep. Correct.

## Bugs found

None found.
