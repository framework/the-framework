# Bug analysis: packages/framework/src/cloud-session-link.test.ts

## Business logic (high-level)

An end-to-end regression pin for #1317 with no sibling source module of its own: the contract it
pins spans `driver/cloud.ts` (the CloudDriver's result event carries the real per-session
`sessionLink` the browser extension reported), `agent-telemetry.ts` (the handler prefers a
driver-known link over the configured template: `event.sessionLink ?? resolveSessionLink(...)`),
and `store/agent-store.ts` (`session` and `session-update` events both fold `sessionLink` onto
the meta, the later one winning). Per `cloud-session-link.test.SPEC.md`, the point is pinning the
"deep link wins" contract *through the real layers*, not per layer — a web agent's meta must end
on `https://claude.ai/code/<session id>`, while the opening `session` event still honestly
records the generic `https://claude.ai/code` that was all that was known before the session
existed.

The test genuinely drives the real code: a real `CloudDriver` (only `fetch`, `git`, `agentTag`,
`pollMs`, `timeoutMs` injected — all real, documented `CloudDriverOptions`/`ExtensionStart`
seams), the real `createDriverEventHandler`/`emitSessionStart`, and a real `AgentStore` on a
mkdtemp'd workspace folding the captured events in order. Verified against the implementations:

- The fake fetch answers the actual protocol: POST → 202 `{id}` (enqueue), GET → 200
  `{state:'created', sessionId, url}` (poll). `pollMs: 1` keeps the poll fast; `timeoutMs: 1000`
  bounds the abort timer, which `CloudSession.prompt` clears in its `finally`, so no timer
  leaks past the test.
- The fake git covers every command the prompt path runs: `remote get-url origin` (an SSH GitHub
  URL, which `githubSlugFor` parses), `commit-tree` (the #1601 anchor sha), and the push (default
  `''` = success).
- Event order matches production: `emitSessionStart` first (the `session` event with the literal
  generic link — `CLAUDE_CODE_SESSION_LINK` has no session-id placeholder, so it is emitted
  literally), then the prompt's `result` driver event, from which the handler emits
  `session-update` with the driver's own URL. The fold applies them in order, so
  `meta.sessionLink` ends as the deep link. Both assertions would fail if any layer regressed
  (template beating the driver link, the fold ignoring `session-update`, or the opening event
  inventing a deep link it did not have).

Edge cases weighed: `foldLive` reads `store.snapshot()` after `close()` — snapshot is the
in-memory meta, valid after close; the tmpdir is removed in `finally`; each `append` is awaited
so the internal write chain cannot outlive the assertions. The `anchorSha` side of the result
event additionally emits a `cloud-anchor` event through the same handler — harmless to this
fold and not asserted here (covered elsewhere). The test relies on the fake daemon answering
`created` on the first poll; the waiting/timeout branches of `createViaExtension` are other
files' tests' business.

## Functions (low-level)

- **`foldLive(events, at)`** — opens a real store in a throwaway workspace with a pinned
  clock (`now`/`clock` are real `OpenStoreOptions`), appends the events in order, closes,
  returns the snapshot; cleanup in `finally`. No `fresh` needed on a virgin mkdtemp. Correct.
- **`SESSION` / `URL`** — a realistic `session_…` id and its claude.ai/code deep link; the
  assertion compares the exact URL. Correct.
- **`extensionThatCreates()`** — the fetch/git fakes described above; distinguishes POST from GET
  by `init?.method ?? 'GET'`, exactly how the driver calls them. Returns the `extension` config
  (daemonUrl/token/fetch/pollMs) and `git` in the shape `CloudDriverOptions` takes. Correct.
- **the test** — asserts (1) `meta.sessionLink === URL` (the deep link won the fold) and (2) the
  opening `session` event carried exactly the generic entry point. Both are exact equalities on
  real outputs; neither can pass vacuously (`assert.ok(opening && …)` fails if the session event
  is missing). Correct.

## Bugs found

None found.
