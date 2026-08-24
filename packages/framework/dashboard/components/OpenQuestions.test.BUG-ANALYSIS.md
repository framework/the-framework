# Bug analysis: packages/framework/dashboard/components/OpenQuestions.test.tsx

## Business logic (high-level)

Covers the test SPEC faithfully: empty → no section at all (`container.textContent === ''` — the
strictest form); a parked question renders with agent name, project, count, and answers against
its own agent (`sendChoice('p1','gate-1','work','user','run-1')`); multi-project questions each
post against their own agent; the card header hands `(projectId, agentId)` up; the intent-line
fallback label; countdown never renders even with `autopilot: true` mocked on (the negative
`Auto accept in` query — meaningful precisely because the preference mock turns autopilot on);
jump-nav absent for one card, present for two with per-session labels and a scroll on click; and
the answered-collapse trio (collapse + count drop + question still visible; expand shows options
with the session link and re-collapses; a rejected post shows `boom`, keeps the gate open and
counted).

Verification that the tests test what they claim:

- Async hygiene: every post-render assertion is inside awaited `waitFor`; clicks follow resolved
  queries; the rejected-post test awaits the error surfacing. No un-awaited work.
- The collapse tests set `sendChoice.mockResolvedValue(null)` because ChoicePanel fires
  `onAnswered` only for a *defined* action result — the beforeEach default (`undefined`) models a
  failed post; the comment documents this contract dependency explicitly. The failed-post test
  additionally asserts `Expand` is absent and the count stays 1 — falsifiable both ways.
- Negative-space assertions are used where the behaviour is an absence (no section, no nav, no
  countdown, no collapse) — all with `queryBy*`.
- Mock hygiene: hoisted RPC mocks reset per test; `cleanup` stops the 5s poll.
  `Element.prototype.scrollIntoView = scrolled` is assigned without restoration — jsdom lacks the
  method natively, later tests in this file don't rely on it, and vitest isolates environments
  per file, so no cross-test contamination; noted as tolerable-but-sloppy, not a bug.

Coverage gaps (recorded because the source bug lives there): no test for a *re-fired* gate
reusing its id after being answered from the hub (the `OpenQuestions.tsx` L15 masking bug — the
suite pins "answered leftovers stay" but never "a fresh firing of the same id reads open
again"), and none for the answered-leftover-after-poll-drop reordering. A regression test should
accompany that fix.

## Functions (low-level)

- Mocks (`onOpenQuestions`, `sendChoice`, preferences with `autopilot: true`): correct hoisted
  pattern; the autopilot-on choice makes the countdown-off test able to fail. Correct.
- `question(overrides)`: complete `OpenQuestion` fixture with a two-option recommended gate;
  `second()` variant for multi-card tests. Correct.
- The nine tests: as analysed above; the jump-nav click filters `getAllByText('fix-ci')` to the
  nav's own node so the card's header copy cannot be clicked by accident. Correct.

## Bugs found

None found. (The missing re-fired-gate regression case is a coverage gap tied to the
`OpenQuestions.tsx` finding.)
