# Bug analysis: packages/framework/src/dashboard/bridge-starts.test.ts

## Business logic (high-level)

Pins the session start-queue's contract (#1328), one test per SPEC bullet of `bridge-starts.test.SPEC.md`: the queued shape, the repo/branch/prompt validation edges, oldest-first single-hand-out claiming, TTL expiry and re-offer, success/failure recording (success without a session id is a failure; failures keep the extension note), the claimed-only resolve rule, and the resettable singleton.

The tests use injected `now` dates for the clock-dependent behavior (claiming, TTL), so nothing sleeps and nothing is flaky. Validation tests assert on `typeof result === 'string'` — the store's error channel — with per-case messages, so a regression names the input that slipped through.

Coverage gaps (not test bugs): `clear()` is untested (also uncalled in production); the resolve-after-re-claim ordering (the claim-identity gap flagged in `bridge-starts.BUG-ANALYSIS.md`) is untested — the "only a claimed request can be resolved" test only covers the never-claimed and unknown-id cases, which is exactly why the source's weaker guarantee goes unnoticed.

## Functions (low-level)

- `INPUT` constant — a valid baseline request; each test overrides one field, keeping the refusals attributable. Correct.
- 'a queued start carries the repo, branch and prompt' — asserts the accepted shape and initial `queued` state. Correct.
- 'a repo that is not owner/name is refused' — covers extra segments, traversal (`../etc`, `owner/..`), shell junk, empty; asserts `owner/.github` passes (leading dot is a legal repo name — only all-dots segments are traversal). Matches the `DOTS_ONLY` guard precisely. Correct.
- 'a branch that could act as syntax is refused' — spaces, `;`, `$()`, empty, over-long all refused; a hand-off ref passes. Correct (documents the regex's purpose as anti-syntax, not full git-ref validation).
- 'an empty or absurd prompt is refused…' — boundary at `MAX_START_PROMPT + 1`; a 50k prompt passes (the framing is long by design). Correct.
- 'claiming hands out the oldest request, once' — two requests, three claims: first, second, undefined. Verifies both ordering and one-hand-out. Correct.
- 'a claim nobody resolved goes back on the queue' — probes TTL−1s (held) and TTL+1s (re-offered) around the injected claim time. Correct; leaves the exact-TTL boundary unpinned (inclusive in the source), which is fine.
- 'a success records the session and its url' / 'success without a session id is recorded as a failure' / 'a failure keeps the extension note' — each asserts the settled state and derived fields. Correct.
- 'only a claimed request can be resolved' — resolve on a queued request leaves it `queued`; resolve on an unknown id must not throw (the final call's lack of assertion is the assertion). Correct as far as it goes; does not cover the re-claimed case (see above).
- 'the store is a singleton, and resettable for tests' — identity check plus reset emptying the list. Correct; resets before and after so it does not leak state into sibling tests.

## Bugs found

None found.
