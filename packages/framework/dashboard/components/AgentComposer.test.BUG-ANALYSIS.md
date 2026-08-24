# Bug analysis: packages/framework/dashboard/components/AgentComposer.test.tsx

## Business logic (high-level)

Tests for `AgentComposer` against `AgentComposer.test.SPEC.md`. The Composer is mocked to two
buttons (`submit-normal` → `('hello','build',{newAgent:false})`, `submit-new-session` →
`('Import tickets from GitHub','prompt',{newAgent:true})`), a props echo span, and a passthrough
of `idleControl` so the slot's Stop/Resume can be pressed. RPCs (`sendMessage`, `sendStart`,
`sendStop`) are mocked; preferences are mocked so the #831 tests can set a conflicting driver
pref and prove the continuation ignores it.

Coverage vs. the test SPEC, block by block:

- **Slot control (#1455)**: live Stop (fires `sendStop('p1','run-1')`, stays disabled), latch
  release on `live` false→true rerender (the #762 resumed-same-id regression), stopped Resume
  (asserts the full `sendStart` tuple: RESUME_MESSAGE, kind `prompt`, `resumeSession`,
  `continueAgentId`, then navigation), refused Resume (error surfaced, no navigation),
  finished-clean offers neither, no-session-id offers no Resume, and the #1460 no-flicker hold
  (busy Resume across an `outcome: undefined` rerender, handover to Stop on `live`). All claims
  in the SPEC's first bullet are genuinely asserted. The "surfaces a refusal" test matches on
  `/agent is already active/i`, which is the wording `useStartAgent` maps `busy: true` to — the
  real mapping code runs (only the RPC layer is mocked), so the assertion is honest.
- **Live (#714)**: ordinary send → `sendMessage` with the agent id, never `sendStart`, no
  navigation; new-session preset → `sendStart` without `resumeSession`/`continueAgentId`, never
  `sendMessage`, navigates to the started agent; refused start → error, no navigation. Matches.
- **Finished (#720/#831)**: resumable note text, continuation tuple (session id + continueAgentId
  + no `sendMessage`), driver mapping both ways (claude-code → no driver option; codex → codex,
  against an opposing pref), no driver/model select, busy-guard refusal. Matches.
- **No session id (#1026)**: placeholder says can't-be-continued, said only there
  (`document.querySelector('p')` null — a tight assertion that also pins "no note above the
  box"), composer still present, busy label "Starting…"; a send starts fresh with no resume
  options. Matches.
- **Options gear (#1172)**: `agentEnded` false live, true ended. Matches.

What the tests do *not* cover (gaps, not bugs; the test SPEC does not claim them): the queued
echo note after a live send (which is where the source's stale-`queued` bug hides), the failed
`sendMessage` path keeping text, and the `files`/context plumbing (owned by Composer's own
tests).

## Functions (low-level)

- **Mocks (L7-41)** — `vi.hoisted` fns reset in `beforeEach`; the Composer mock's buttons are
  disabled by `props.busy`, mirroring the real gating closely enough for the double-submit
  guards to stay out of scope. The mock renders `idleControl` unconditionally — the real
  Composer only shows it when the box is empty, but that display rule is Composer's own tested
  contract, so exercising the control here is sound. Correct.
- **`renderComposer(over)` (L45)** — defaults `live` true, `agentId 'run-1'`; returns the
  `onAgentStarted` spy. Correct.
- **`props()` (L53)** — parses the echo span. Correct.
- **Per-test analysis** — each async test awaits its `waitFor`s; negative assertions
  (`not.toHaveBeenCalled`) run after a positive `waitFor` on the same flow, so they cannot pass
  vacuously by racing. The latch tests drive `live` via `rerender`, matching how the real parent
  feeds the poll's verdict. `sendStop.mockResolvedValue(undefined)` exercises the real
  void→`true` mapping in `stopSession`. No test can pass with the behavior it pins broken (I
  checked each against the source paths): e.g. removing the `continueAgentId` spread fails two
  tests; dropping the `resuming` latch fails the #1460 test at the `outcome: undefined` rerender.
- **Typing** — `sendStart.mockResolvedValue({ ok: true })` (no agentId) in the finished block
  matches `useStartAgent`'s `{ agentId?: string }` success shape; the assertion
  `onAgentStarted` called with `('hello', undefined)` pins that a missing agent id is passed
  through rather than faked. Correct.

## Bugs found

None found.
