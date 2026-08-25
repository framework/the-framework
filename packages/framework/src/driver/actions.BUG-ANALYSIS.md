# Bug analysis: packages/framework/src/driver/actions.ts

## Business logic (high-level)

The `actions` run target (#610/#1050/#1085): each turn is one GitHub Actions workflow run —
dispatch, poll, download the artifact, replay the transcript. It implements the same
`Driver`/`DriverSession` seam as the local drivers; only the tempo differs (minutes, and no live
stream). The pieces and their invariants:

**Dispatch.** `POST /repos/{o}/{r}/actions/workflows/{wf}/dispatches` with
`{ref, inputs:{prompt, correlation_id, branch, model?, resume_session_id?}}`. The framing is
*prepended to the prompt text* rather than passed separately, because the prompt is an action input
(safe for multi-line text) while a system-prompt flag would have to survive shell quoting inside the
workflow — the SPEC calls that an injection seam not worth opening, and the code matches. The two
values that *do* reach the runner's shell as environment variables (`model`, `resume_session_id`) go
through `assertToken`, and because the inputs object is built before `this.api(...)` is called, an
unsafe value refuses the turn **without dispatching** — exactly what the SPEC requires.

**Correlation.** `workflow_dispatch` returns 204 with no run id, so each turn carries
`"<session id>-turn-<n>"`, echoed by the workflow into the run name and the artifact name and matched
with `includes`. The session id is `actions-<process counter>-<random tag>`, and the random tag is
the part that matters: the daemon spawns a fresh process per run, so the counter alone restarts at 1
and two agents would poll for the same name. Substring matching is safe here despite `turn-1` being
a prefix of `turn-11`, because turns are strictly sequential within a session — the run for turn 11
cannot exist while turn 1 is being polled for.

**Polling.** `findWorkflowRun` lists the repo's 50 most recent `workflow_dispatch` runs and matches
the correlation id; the loop announces the run URL once, returns on `completed`+`success`, throws
naming the URL on any other conclusion, throws on the deadline, and throws on either abort signal
(the session's or the per-prompt one) both before and after each sleep. The deadline is computed once
from the injected clock; the completed check precedes the deadline check, so a run that finishes on
the same tick as the timeout still counts as a success. Stopping ends the *wait* only — the workflow
run keeps going on GitHub and may still push to the branch. That is what the SPEC describes ("ends
the wait immediately"), so it is behavior rather than a leak, but it is the one place where the
subsystem SPEC's "no stray processes" rule does not extend to this driver.

**Continuity.** One branch per session (`<prefix>framework-<session id>`), named by the driver and
handed to the workflow because a `workflow_dispatch` run reports no branch of its own. `this.branch`
is only *overwritten* when a run reports one, so a turn that pushed nothing does not reset the chain
back to the default ref. The agent's own CLI session id is carried across turns for `resume`.

**Transcript.** The artifact zip is downloaded, `execution.json` is replayed through the same
`StreamJsonParser` the local Claude driver uses (the file is a JSON array of exactly the SDKMessages
the CLI prints one per line — the array-vs-JSONL difference is the whole adapter), and `meta.json`
yields the pushed branch. A missing `execution.json` fails the turn and names what the artifact did
contain; a malformed `meta.json` costs only `readCode`, per the SPEC. Verified that
`StreamJsonParser.push` is line-oriented with no internal buffering, so feeding it one
`JSON.stringify(message)` per element (no trailing newline) is correct.

### The first turn's ref is a hard-coded `'main'` that nothing ever overrides

`dispatch` sends `ref: this.branch ?? this.config.ref ?? 'main'`. The SPEC says "the first turn runs
on the project's **default ref**", and `ActionsDriverOptions.ref` documents itself as "Git ref the
first turn runs on" — but the only construction site, `cli.ts` (~L1172), builds
`actionsConfig = { owner: slug.owner, repo: slug.repo, token }` and never sets `ref`, so the literal
`'main'` is the effective behavior for every agent. On a repository whose default branch is `master`,
`develop`, or anything else, the dispatch fails with GitHub's 422 "No ref found for: main" and the
very first turn of every `--run-on actions` agent dies with a raw API error that names neither the
cause nor the fix. Nothing else in the file compensates: there is no `GET /repos/{o}/{r}` to read
`default_branch`, and the CLI's own preflight for this target checks only the remote slug and the
token.

### Recorded, not reported

- `readCode` has **no callers anywhere in the framework** today (it is an optional member of the
  `Driver` seam, exercised only by this file's tests), which makes the following unreachable rather
  than live: (a) a path containing `..` would be normalized by `fetch`'s URL parsing and could
  address a different API endpoint — every caller would have to pass a framework-controlled path;
  (b) GitHub's contents API answers a file over 1 MB with `{"content":"", "encoding":"none"}`, which
  this code would decode to `''` and return as a successful empty read rather than an error.
- A transient GitHub 5xx during polling rejects the whole turn even though the runner is still
  working; there is no retry. Consistent with the project's preference for simple code, and a failed
  turn is a legitimate outcome.
- `prompt` does not check the abort signal *before* dispatching, so a session stopped in the instant
  before a turn starts still spends a workflow run. No caller prompts after a stop.
- `readRunArtifact` falls back to `artifacts[0]` when no artifact name matches the correlation id.
  Within a single already-correlated run that is the right artifact; it is only a wrong answer if a
  workflow ever uploads several.

## Functions (low-level)

- **`ActionsDriver.start` (L38)** — constructs a session per call; no shared state beyond the module
  counter. Correct. No `readQuota` by design (the quota belongs to the token's account and no runner
  survives to be asked).
- **`ActionsSession` constructor (L110)** — session id `actions-<++counter>-<tag>`, run branch from
  it, `lastSessionId` seeded from `resumeSessionId` so a resumed agent's *first* turn can continue
  the CLI conversation. Correct.
- **`prompt(text, opts)` (L122)** — framing, `start` event, correlation id, dispatch, `notice`, poll,
  artifact, branch capture, replay, `result` event. Errors from any stage propagate, so a failed run
  can never be mistaken for a finished turn (the subsystem's "gated on outcomes" rule). Correct
  apart from the ref issue above, which lives in `dispatch`.
- **`readCode(path)` (L156)** — no-branch case throws a plain, explicit message per the SPEC; path
  segments are `encodeURIComponent`d, the ref is encoded; a directory (array response, no `content`)
  is refused. See the unreachable caveats above. Correct for its callers (none).
- **`dispose()` (L164)** — nothing to free; every run reaps itself. Correct.
- **`dispatch(prompt, correlationId, resume)` (L170)** — inputs assembled and validated before the
  request. **Bug found** (the `'main'` fallback described above).
- **`awaitWorkflowRun(correlationId, emit, promptSignal)` (L184)** — analyzed above; the ordering of
  the completed/deadline/abort checks is right, the announce-once flag is right, and the injected
  clock/sleep make the loop testable without wall-clock time. Correct.
- **`findWorkflowRun(correlationId)` (L215)** — `event=workflow_dispatch&per_page=50`, newest first,
  matched on the run name. A missing `workflow_runs` array degrades to "not found yet" rather than
  throwing. Correct.
- **`readRunArtifact(runId, correlationId)` (L221)** — correlation-matched artifact with a
  first-artifact fallback; a run with no artifacts throws naming the likely cause (the collect step);
  a zip without `execution.json` throws and lists what was inside, which is the SPEC's requirement;
  `meta.json` is optional. Correct.
- **`owner` getter (L236)** — returns `"<owner>/<repo>"`; every call site interpolates it after
  `/repos/`, so the paths are right despite the name. Correct.
- **`throwIfAborted(promptSignal)` (L241)** — either signal aborts, with one message. Correct.
- **`api<T>(path, init)` (L247)** — 204 → `undefined as T` (the dispatch case); otherwise parsed
  JSON. Correct for its two shapes of caller.
- **`request(path, init)` (L254)** — auth and version headers, `content-type` only with a body,
  caller headers last so they can override, non-2xx throws with method, path, status and a truncated
  body. The token is never interpolated into a message. Correct.
- **`replayTranscript(json, emit)` (L291)** — parse errors and non-arrays throw with distinct
  messages (a shape we do not recognize must not read as an agent that did nothing); an empty array
  is a legitimate empty turn. Non-object elements are stringified and harmlessly ignored by the
  parser. Correct.
- **`readBranch(json)` (L308)** — non-string/empty/malformed → `undefined`, so a broken meta costs
  `readCode`, not the turn. Correct.
- **`assertToken(value, what)` (L319)** — `^[A-Za-z0-9._:-]+$`, anchored, rejects the empty string
  and every shell metacharacter, quote, space and newline. The offending value is echoed in the
  error; these are model names and session ids, not secrets. Correct.
- **`safeText(res)` (L325)** — best-effort body, capped at 500 chars, never replaces the real error.
  Correct.

## Bugs found

1. **L179 (`dispatch`): the first turn is dispatched against a hard-coded `'main'`, and no caller
   ever supplies `ref`.** `cli.ts` (~L1172) builds `ActionsDriverOptions` as
   `{owner, repo, token}` only, so `this.config.ref` is always `undefined` and the literal fallback
   decides. On a repository whose default branch is `master` (or any non-`main` name), every
   `--run-on actions` agent fails on its first turn with GitHub's raw
   `422 ... No ref found for: main`, and the user is told nothing about the cause. This contradicts
   the SPEC ("The first turn runs on the project's default ref") and the option's own JSDoc.
   Severity: **major** (the run target is unusable on such repos, with an opaque error).
   Fix sketch: resolve the repository's default branch once — `GET /repos/{owner}/{repo}` →
   `default_branch`, cached on the session — and use it as the fallback; or have `cli.ts` pass the
   project's default ref into `actionsConfig`. Either way the hard-coded `'main'` (and the test that
   pins it, `actions.test.ts` L159/L198) should follow the repository.
