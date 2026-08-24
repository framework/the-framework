# Bug analysis: packages/framework/dashboard/components/AgentView.test.tsx

## Business logic (high-level)

Focused suite for AgentView's one hard decision — which event log a finished agent shows —
matching `AgentView.test.SPEC.md`'s six bullets one-to-one. The frame is stubbed
(AgentActionBar reduced to its `actions` slot so the handoff cluster stays reachable;
AgentComposer to null); reads/control RPCs and the preferences module are mocked so jsdom never
fetches. The six tests:

1. **Swap to archive once it has events** — archived text appears, channel text gone. Pins the
   `shown` preference for a caught-up archive. ✓
2. **Empty archive never replaces (#1383)** — `onAgent` resolves `[]`; asserts the channel line
   stays and the "no events" label does not appear. Awaits the read first, so the negative
   assertion is not vacuous. ✓
3. **Nothing anywhere → "This agent has no events."** — also proves the empty label is the
   caller-supplied finished-state one. ✓
4. **Stale archive never hides a resumed leg (#1460)** — events = archive + new `session`
   boundary + new line; asserts the streamed line renders while `live` is false. Pins
   `feedAhead` + `feedLive`. ✓
5. **Foreign journal never beats the archive (#1460)** — a longer feed whose first event
   differs from the archive's; asserts the archive line renders and the foreign line does not.
   Pins the fingerprint guard. ✓
6. **Archive catches up and takes back over** — `onAgent` resolves stale-then-full
   (`mockResolvedValueOnce` then `mockResolvedValue`); waits for ≥2 calls (the
   `archiveBehind`-triggered re-read) and for the epilogue "branch pushed" text, which is
   rendered by the real `HandoffSummary`... actually by the feed's handoff row — either way it
   only exists in the full archive, so the assertion genuinely requires the re-read + takeover.
   ✓

Each test drives the logic through public props and mocked RPC answers — no internal state is
poked, so the tests would survive a refactor of the mechanism while still failing on behavior
regressions. All `waitFor`s awaited; `vi.clearAllMocks()` plus re-priming of the two reads whose
default (`undefined`) would otherwise break `useAgentHandoff`/retained.

Coverage notes (consistent with the test SPEC's narrow scope): the Resume-offer rules are
explicitly delegated to AgentComposer's suite (closing comment); `working`-vs-`live` gating,
the removed-worktree flow (where `AgentView.BUG-ANALYSIS.md` bug 1 lives), the notices, and the
`armedDefault` seeding are untested here — none claimed by the test SPEC.

## Functions (low-level)

- **Mocks (L5-32)** — every `rpc/reads` symbol AgentView's tree imports is provided; the
  bridge/choice mocks exist because the feed renders inline gates. Shapes match the real
  signatures. Correct.
- **Fixtures (L36-41)** — `view()` defaults to a finished agent (`live={false}`) with one
  channel line; overrides per test. `LIVE_EVENTS`/`ARCHIVED` differ in first event, which is
  what makes them distinct journals for the fingerprint — deliberate and load-bearing in test
  5; in tests 4/6 the resumed/ahead feeds are built by *extending* `ARCHIVED`, keeping the
  fingerprint equal — also load-bearing. Correct.
- **beforeEach (L43)** — `mockResolvedValue` after `clearAllMocks` restores the two reads used
  unconditionally by hooks. Correct.

## Bugs found

None found.
