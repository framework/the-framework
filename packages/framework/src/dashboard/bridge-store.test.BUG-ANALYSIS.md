# Bug analysis: packages/framework/src/dashboard/bridge-store.test.ts

## Business logic (high-level)

Covers the answer half of the bridge store (#1237/#1554) exactly as `bridge-store.test.SPEC.md` lists it: label validation (unknown labels, duplicates, single-select cardinality), the composed continuation/takeover/multi wording, delivery success (question dropped, re-report ignored, genuinely new question surfaces and clears the resolved answer), delivery failure (question kept, note kept, retry replaces), withdrawal rules, stale-ack rejection by answer id, and the discard of an uncollected pick when the session moves on.

Notably untested here (covered by the source analysis, not a test defect): the transcript store (`recordEvent`/`events`), diagnostics (`recordContact`/`recordVersion`/`hello`/`extensionAlive`), `clear`, and the singleton accessors — those are exercised through `bridge-endpoints.test.ts`/server tests elsewhere or are trivial.

The `question()` helper builds a fixed two-option question with a constant `receivedAt`; every mutation goes through the real public API, so the tests pin observable behavior rather than internals. Each `queueAnswer` result is type-narrowed with `assert.ok(typeof queued === 'object')` before use, so a refusal string fails the test at the right line rather than as a property-of-string crash.

## Functions (low-level)

- 'an answer can only be a label the parked question offered' — asserts the exact refusal strings for: no parked question, injection-shaped label (`rm -rf /`), valid+invalid mix, empty pick, double pick on single-select; then a valid pick queues and shows as pending. The refusal-string equality means a reworded message fails the test — deliberate pinning of the API's error channel. Correct.
- 'what gets typed is the continuation a local gate re-prompts with' — pins the exact `continuationPrompt` sentence, which is the cross-module contract with turn-gate.ts (#1554: cloud sessions must hear answers exactly as local ones do). Correct.
- 'a multi-select takes a subset of labels, none included…' — two labels joined with `', '`, empty pick renders `(none)`, duplicate label refused. Matches await-gate wording. Correct.
- 'a stop option hands the session over instead of continuing it' — pins the exact `takeoverPrompt` sentence for a stop pick and the continuation tail for a non-stop pick. Correct.
- 'a delivered answer resolves the question, and its re-report is ignored' — success path: question gone, answer `sent`, pending empty; re-record of the identical question stays gone; a new title surfaces and clears the resolved answer. This is the strongest test in the file — it pins the answered-fingerprint memory and its invalidation together. Correct.
- 'a failed delivery keeps the question so the user can retry' — failed state + note, question intact, retry replaces the failed attempt as pending. Correct.
- 'a queued answer can be withdrawn, a resolved one cannot' — cancel true/false around delivery; state remains `sent`. Correct.
- 'a stale ack cannot resolve a newer answer' — queues twice, acks the first id: the second stays `queued` and the question stays parked. Verifies the id guard, and implicitly that re-queuing replaces. Correct.
- 'an undelivered pick dies with the question it answered' — new question purges the pending answer. Correct.

All asserts run synchronously against a fresh store per test; no shared state, no missing awaits (the store API is synchronous).

## Bugs found

None found.
