# Bug analysis: packages/framework/dashboard/lib/event-labels.test.ts

## Business logic (high-level)

Pins the three behaviors of `eventKindLabel`: the four jargon renames (each asserted
individually, exact strings), de-hyphenation of clear kinds (including the multi-hyphen
`ready-for-merge`, which pins the *global* replace), and pass-through of plain single-word kinds.
The assertions match the SPEC's list one-for-one, so a rename drift or a dropped override fails
loudly.

The tests call with real members of the `EventKind` union, so they double as a compile-time check
that those kinds still exist. Nothing vacuous; no async; no state.

Gap (noted): nothing pins that values are lowercase (the CSS-uppercase contract) — but the exact
`toBe` strings are lowercase, which pins it implicitly for the tested kinds.

## Functions (low-level)

- No helpers; direct assertions. Correct.

## Bugs found

None found.
