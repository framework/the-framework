# Bug analysis: packages/framework/src/events.test.ts

## Business logic (high-level)

Despite the name, this file pins down three modules: `pickedIds` from `events.ts`, `formatFrameworkEvent` from `terminal.ts` (the bulk), and the session-link helpers from `session-link.ts`. Per its SPEC, coverage is: pick normalization, session-link template detection/resolution, gate rendering (single + multi), armed-handoff phrasing (merge included, pre-#1382 records, merge-without-pr), end states, spend/token lines, quota lines, prompt preview truncation, post-merge cleanup outcomes, and the merge half of a handoff (all four outcomes plus withheld reasons plus `already-landed`).

The tests are all synchronous, use `node:test` + `strict` assert, and each asserts a concrete expected string or regex — none is vacuous, none needs awaiting. I verified several non-obvious expectations against the implementation:

- The no-price token line: `186 + 12032 + 6 = 12,224` matches `terminal.ts` (input + cacheRead + output; cacheCreation excluded by design there — the test's fixture has `cacheCreationTokens: 0`, so the test would not catch cacheCreation being dropped, but that is the implementation's documented choice, not a test bug).
- `assert.doesNotMatch(line!, /\$/)` genuinely guards the "$0.0000 reads as free" regression.
- The truncation test checks `line.length < 160 && line.endsWith('…')` for a 300-char prompt — a real bound, falsifiable.
- The pre-#1382 record case (`{ push: true, pr: true }` with no `merge`) pins the conservative "draft PR" reading demanded by `events.SPEC.md`.
- The `merge: true, pr: false` case pins "never promise a merge without a PR".

Tests match the claims of `events.test.SPEC.md` line by line; no claimed behavior is untested and no test asserts something other than its title.

Minor observations (not bugs): the non-null assertions (`line!`, `formatFrameworkEvent(...)!`) suggest `formatFrameworkEvent` is typed as possibly returning undefined for some events; where used with `assert.match` a `null` would throw anyway, so no silent pass is possible. The quota test builds a UTC timestamp and asserts `toISOString()` inclusion — timezone-independent, so not flaky.

## Functions (low-level)

The file defines no functions of its own beyond inline test bodies; per test:

- **hasSessionIdPlaceholder test** — template vs literal; both directions asserted. Correct.
- **pickedIds test (#332)** — single id, subset, empty array, empty string. Covers all four input shapes of the union. Correct.
- **multi-select render test (#332)** — asserts exact checklist output including pre-checked marks. Correct.
- **armed-line test (#1382)** — four permutations (merge true/false/absent, pr false). Correct and complete for the display contract.
- **single-select render test (#304)** — recommended mark ● vs ○. Correct.
- **choice-resolved test (#332)** — subset, empty ("(none)"), single. Correct.
- **resolveSessionLink test** — placeholder fill, every-occurrence replacement (`'z-z'` — pins global replace, a classic `String.replace` first-occurrence bug catcher), literal passthrough. Correct.
- **session-update / system-prompt / prompt-preview tests** — exact-line asserts; the preview test also pins the "not just 'prompt sent'" regression. Correct.
- **preview / end / usage / quota / on-before-mergeable / handoff-merge tests** — exact strings or anchored regexes; the quota test also pins that an unknown status renders rather than vanishing. Correct.

## Bugs found

None found.
