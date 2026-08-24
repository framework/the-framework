# Bug analysis: packages/framework/dashboard/components/CloudAgentNotice.test.tsx

## Business logic (high-level)

Covers all four SPEC'd areas (`CloudAgentNotice.test.SPEC.md`): the notice banner, the bridge
question, answering, and the mirror row — plus direct `scrubMirrorText` unit tests. Cross-checked
each test against the component: every assertion pins real behavior and can fail.

Mock hygiene: the three read RPCs and three control RPCs are module-mocked (comment correctly
notes unmocked stubs would fetch `/_rpc/*` into a jsdom void). `afterEach` does full
`mockReset` + re-prime of resolved values — no cross-test leakage even though `mockReset` wipes
implementations (they are re-primed explicitly). `await import(...)` after `vi.mock` is the
correct hoisting-safe pattern. Real timers: each test finishes well inside the 4s poll cadence,
so only the mount-time read fires — intervals are cleaned by `cleanup()`.

Fixture note: `handOff()` builds the driver action event (`cloud <url>`) that `cloudSession`
parses — the tests therefore exercise the real event-parsing path rather than stubbing
`live-state`, which strengthens them. The local `const URL = 'https://…'` shadows the global
`URL` constructor — harmless here (never used as a constructor), style only.

What is NOT covered (gaps, not bugs): the parked/"Choice sent…" state after a bridge pick — the
test "one click answers" only asserts the RPC call, so ChoicePanel's sent-state never engaging
(see `ChoicePanel.BUG-ANALYSIS.md` bug 2) is invisible here; the ≤4s window where a second pick
could race the first (the "cannot race" test pre-mocks the queued answer rather than clicking
through); and successive different questions in one session (the missing-key bug in
`CloudAgentNotice.BUG-ANALYSIS.md`).

## Functions (low-level)

- **"says the session is still being created…"** — no events → "Starting…" + no link. Sync render,
  fine.
- **"links through…" / "offers the teleport command…" / "opens its own PR" / "question shows
  here"** — text/link assertions against the session banner; `href` compared to the exact URL
  (query string preserved — pins that `cloudSession` keeps the full URL). Correct.
- **"renders nothing for the other targets"** — loops local/actions/remote plus targetless;
  `container.firstChild` null. Note multiple `render`s without intermediate cleanup are fine
  since each uses its own container. Correct.
- **Question describe**: awaits via `waitFor`/`findBy` on async poll results; asserts the shared
  gate shape (`region` named by title, "Your call", Recommended tag) — pins #1554's same-panel
  requirement. "asked for by cloud session id" asserts the argument. "shows nothing extra" awaits
  the poll call, then asserts absence — ordering sound because the awaited expectation *is* the
  async read. "never asks before the hand-off" — sync assert that the mock was not called;
  adequate because with no session the hook never schedules a read. Correct.
- **Answering describe**: click → `sendBridgeAnswer` called with labels, `sendChoice` NOT called
  (pins the routing). Multi: tick "Tests" (default "Lint" pre-ticked) → Accept 2 → labels
  ['Lint','Tests'] — order pinned to Set insertion order (defaults first), which matches the
  component; would fail if defaults stopped pre-ticking. Refused pick: `{ok:false,error}` →
  thrown by bridgeSend → panel error text. Queued: "Sending …" visible, question title gone,
  Cancel → cancel RPC with session id. Sent: "Answered …", no Cancel. Failed: failure line with
  note + question back. All properly awaited. Correct.
- **Mirror describe**: ordered turns in the labelled status box; one-line user turns with
  full-text tooltip (asserts exact `textContent` 'you › …' — strong); whole agent turns
  (whitespace-pre-wrap newline preserved in textContent); connecting placeholder (awaits the poll
  call first — sound); chrome scrubbing through the component; nothing for other targets/no
  hand-off plus `onBridgeEvents` not called; the notice no longer carrying the transcript
  (awaits the question poll, then asserts mirror text absent — the notice renders no transcript
  synchronously or asynchronously, so the anchor is adequate). Correct.
- **scrubMirrorText describe**: anchoring, hole-collapsing ('a\n\nchrome\n\nb' → 'a\n\nb' — I
  traced the split/filter/join/replace pipeline and it holds), all-chrome → ''. Correct.

## Bugs found

None found. (Coverage gaps recorded above; they hide two component-side bugs reported in the
source files' analyses, but no test here asserts a wrong thing or fails to await.)
