# Bug analysis: packages/framework/src/driver/actions.test.ts

## Business logic (high-level)

Unit suite for the `actions` run target, driven entirely through a `fetch` double plus injected
clock/sleep, so a full dispatch → poll → artifact → replay cycle costs no wall-clock time. The
double is a small GitHub REST simulator (dispatch 204, run listing, artifact listing, artifact zip,
contents API) that records every call, which lets the assertions be about *what was sent* (the ref,
the branch input, the correlation id, the model) rather than only about the returned turn. That is
the right level for this driver: almost everything it can get wrong is in the request bodies.

The `EXECUTION` fixture is a trimmed real `claude-code-action@v1` execution file — system/init,
an assistant text block, an assistant tool_use block, and a result with usage — so the replay path
is exercised against the same shapes the local Claude driver parses, which is the whole claim of the
adapter ("array-vs-JSONL is the entire difference").

What the suite pins, against `actions.test.SPEC.md`:

- **Dispatch/poll/replay end to end**, including that polling continues through `queued` and
  `in_progress` (asserted by counting the run-listing calls — 3 — so a driver that read the run once
  and gave up, or that polled an extra time after completion, fails).
- **Framing in front of the prompt** (session framing, then per-turn framing, then the task text, in
  that exact order) and the correlation id equal to `${session.id}-turn-1`.
- **Branch continuity**: the same `branch` input on every turn, and the second turn's `ref` being the
  branch the first run reported in `meta.json` (`['main', 'claude/issue-610']`).
- **Resume**: no `resume_session_id` on the first turn, the transcript's `sess-abc` on the second.
- **Model pass-through**, and refusal of a shell-breaking model id.
- **A red run** failing the turn with the conclusion *and* the run URL in the message; **a run that
  never finishes** hitting the timeout.
- **`readCode`** reading from the pushed branch (asserted on the request URL's `?ref=`, not just the
  content) and failing plainly before any branch exists.
- **The event stream**: `start` first, the assistant text, the tool call, the run URL as an action,
  `result` last.
- **No `readQuota`** on the driver.
- **`replayTranscript`** directly: the parser's event order (`session` first, per #1322), an empty
  array as a legitimate empty turn, and both rejection shapes (not an array, not JSON).

Fixture fidelity: `makeZip` here is the stored-entry subset of the reader's own test fixture (no
CRCs, no deflate), which is enough because `actions-zip.test.ts` covers the reader. The zip is handed
back through `arrayBuffer()` with the correct `byteOffset`/`byteLength` slice, so a pooled Buffer
cannot leak neighbouring bytes into the archive — a real trap with `Buffer.from(string)` and
`.buffer`.

Coverage gaps (recorded, not defects):

- The artifact double is named `framework-run-actions-1-turn-1`, which never contains a real
  correlation id (those carry a random tag), so **every test takes `readRunArtifact`'s
  `?? list.artifacts?.[0]` fallback** and the correlation-matched branch is never exercised. A
  regression that broke the name matching entirely would still pass this suite.
- Neither abort path (`DriverStartOptions.signal`, `DriverPromptOptions.signal`) is tested, though
  the SPEC calls Stop out explicitly.
- The unsafe-model test asserts the rejection but not that **nothing was dispatched**, which is the
  half of that SPEC clause that actually matters ("refuses the turn instead of dispatching it"); a
  regression that validated after the dispatch would still pass.
- No test covers a run whose artifact has no `execution.json` (the "names what the artifact did
  contain" error) or an unreadable `meta.json` (the turn must still succeed, losing only `readCode`).
- `body.ref === 'main'` (L159) and `['main', 'claude/issue-610']` (L198) pin the driver's hard-coded
  first-turn ref. That literal is the subject of the bug recorded in `actions.BUG-ANALYSIS.md`; these
  assertions are what would have to change with it, and their presence is why the gap has survived.

## Functions (low-level)

- **`EXECUTION` (L11)** — covers session announcement, text, tool_use and result+usage in four
  messages. Correct.
- **`makeZip(files)` (L26)** — stored entries only; leaves method 0 (`Buffer.alloc` zero-fill) and
  tracks `offset` for the central records. Valid archive bytes, so the real reader is exercised
  rather than stubbed. Correct.
- **`fakeGitHub(opts)` (L74)** — routes by URL substring; the run listing answers with the *latest*
  dispatch's correlation id, so a second turn cannot accidentally match the first turn's run (the
  comment explains exactly this); `poll` walks the `agents` array and clamps at the last entry, which
  is what makes the timeout test loop forever on `in_progress`. `json()` fakes only `ok`/`status`/
  `statusText`/`json`, which is precisely the slice `request()` touches. Any unrouted URL throws with
  the URL, so a driver that called an unexpected endpoint fails loudly instead of silently. Correct.
- **`makeDriver(opts)` (L121)** — a clock that only `sleep` advances, so the timeout tests are exact
  and hermetic. Correct.
- **Dispatch/poll/transcript test (L139)** — asserts text, session id, the full usage object, and the
  poll count. Correct.
- **Correlation/framing test (L151)** — asserts the dispatch URL shape, the ref, the composed prompt
  string, and the correlation id derived from the session's own id (not a literal), so a change to
  the id scheme cannot silently drift. Correct.
- **Unique-prefix test (L166)** — see bug 1 below: it asserts only that two sessions in *one* process
  have different ids, which the module-global `sessionCounter` guarantees on its own.
- **Branch-naming test (L174)** — both that the branch is `claude/framework-<session id>` and that it
  is identical across turns. Correct.
- **Branch-continuity test (L188)** — `deepEqual` on the two refs, so both the initial ref and the
  hand-off are pinned in one assertion. Correct.
- **Resume test (L202)** — asserts the *absence* on turn 1 as well as the value on turn 2, so a
  driver that always resumed would fail. Correct.
- **Model tests (L213, L220)** — pass-through, and the refusal matched by message. Correct (see the
  gap above).
- **Red-run test (L228)** — regex spans conclusion and URL with the `s` flag. Correct.
- **Timeout test (L235)** — builds its own driver with a 5 s budget and a run stuck `in_progress`;
  the fake clock guarantees termination. Correct.
- **`readCode` tests (L243, L253)** — the first asserts the request URL's encoded `?ref=`, which is
  the actual claim ("from the pushed branch, not the default branch"); the second the plain refusal.
  Correct.
- **Event-stream test (L259)** — first `start`, last `result`, with the text, the tool call and the
  run URL in between. Correct.
- **Quota test (L272)** — `readQuota` undefined on a `Driver`-typed handle, i.e. absence by omission.
  Correct.
- **`replayTranscript` tests (L279, L291)** — event order including the up-front `session`, the empty
  array as `{text:''}`, and the two distinct rejections. Correct.

## Bugs found

1. **L166-172 (`ActionsDriver gives each session a unique correlation prefix …`): the test cannot
   fail for the reason it states.** `sessionCounter` is a module-global incremented in the
   `ActionsSession` constructor, so two sessions created in the same process always get different
   ids (`actions-1-…` vs `actions-2-…`) **whether or not the random tag exists at all** — deleting
   `runTag`/`randomRunTag` from the driver would leave this test green. Its own comment names the
   scenario it means to cover ("The daemon spawns a fresh process per run, restarting the session
   counter"), which is exactly the scenario the assertion does not reach. A regression that dropped
   the random tag would reintroduce #1050 (a fresh daemon process latching onto another agent's
   workflow run) with a passing suite. Severity: **minor** (a test defect, no product misbehavior
   today). Fix sketch: assert on the tag rather than on the whole id — e.g. compare
   `a.id.split('-').slice(2).join('-')` with the same for `b`, or construct both sessions with
   `runTag` left at its default and assert the two tags differ — so the counter cannot carry the
   assertion.
