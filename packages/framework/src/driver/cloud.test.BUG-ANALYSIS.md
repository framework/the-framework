# Bug analysis: packages/framework/src/driver/cloud.test.ts

## Business logic (high-level)

Covers the cloud hand-off end to end against a scripted daemon (`fakeDaemon`: POST answers the queue response; each GET pops the next state, last repeats) and a scripted git runner (`fakeGit`: GitHub origin URL, fixed anchor sha, optional push failure / missing remote). What is genuinely pinned:

- The happy path: turn resolves with the session id/text; the POST body names repo, the pushed ref (= session id) and the whole prompt; polling continues until `created` (GET count 3 for queued→claimed→created).
- Event surface: `cloud <url>` action, `result` with `sessionId`/`sessionLink`/`anchorSha`, the queued notice.
- Prompt composition (#1497) as an exact string, and the bare-task cases.
- Anchor mechanics (#1601/#1320): the exact `commit-tree` and `push` argv, the branch in the POST, the anchor on the result; failed push → named error and zero daemon requests; no remote → named error, no push, no requests.
- Each missing prerequisite's message (no daemon / 409 / 404 / extension-failed note).
- One-hand-off-only (single POST across three prompts, same session id back), "already" wording on later passes, single `action` event.
- Unique session ids, disposed-session refusal, pre-aborted signal refusing before any request, timeout during the sleep window naming the extension, `readCode` absent, `isHandsOff('web')` (the location fact this driver's one-turn design leans on).

Soundness checks:

- `fakeDaemon` records requests before answering, so "nothing was asked" assertions (`requests.length === 0`) are trustworthy.
- The timeout test uses `states: [{state:'claimed'}]` forever with `pollMs: 5` / `timeoutMs: 40`, so the abort lands in the sleep — deliberately or not, this leaves the timeout-mid-fetch path untested, which is exactly where the source bug (raw AbortError instead of the named message) hides. Gap noted in the source analysis.
- All tests await their prompts/rejections; regexes in `assert.rejects` are specific enough to fail on message regressions.

One assertion is defective (below): the "pushed before the request" check on L115 is arithmetic that cannot detect ordering.

## Functions (low-level)

- **`fakeGit({calls, fail, noRemote})`** — records argv per call; `remote get-url` → GitHub URL or throw; `commit-tree` → fixed sha + newline (trim exercised); `push` optionally throws. Verdict: correct.
- **`fakeDaemon(queue, states)`** — as above; uses real `Response` objects so `.ok`/`.json()` behave. Verdict: correct.
- **`driverWith(daemon, git, opts)`** — standard wiring with `pollMs: 1`, `timeoutMs: 1000`, fixed tag. Verdict: correct.
- **Individual tests** — as analyzed; all can fail except the L115 clause. Verdict: one bug.

## Bugs found

1. **L115**: `assert.ok(git.calls.indexOf(push!) < daemon.requests.length + git.calls.indexOf(push!), 'pushed before the request')` is a tautology whenever `daemon.requests.length > 0` — `a < b + a` reduces to `b > 0` — so it verifies only that *some* request happened, never the push-before-request ordering its message claims. If the implementation queued the request first and pushed after, this assertion would still pass. Severity: minor (the ordering is indirectly covered by the failed-push test asserting zero requests, but this line is a can't-fail-for-its-claim assertion). Fix sketch: capture the request count at push time inside the fake git runner (e.g. in the `push` arm record `daemon.requests.length`) and assert it is 0, or push `['push']`/`['POST']` markers into one shared sequence log and assert their relative order.
