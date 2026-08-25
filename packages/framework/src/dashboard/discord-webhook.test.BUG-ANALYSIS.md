# Bug analysis: packages/framework/src/dashboard/discord-webhook.test.ts

## Business logic (high-level)

Covers `postDiscordWebhook`, the single Discord webhook transport shared by the activity and
interventions notification feeds. Four behaviours, all traceable to #940 (an over-long "needs you"
batch was silently posting nothing, because Discord rejects a message over 2000 characters outright
rather than truncating it):

1. Content over the limit is clamped *before* the POST, with the cut visibly marked.
2. A non-ok HTTP response resolves `false` — it must not pass as delivered, since the caller uses the
   boolean to decide whether to log a failure.
3. A network error also resolves `false` rather than throwing out of a daemon watcher (an unhandled
   rejection in a poll loop is the failure this guards).
4. An end-to-end check through `postInterventionsDiscord` that a realistic 40-item batch survives.

The tests inject `fetch`, so nothing touches the network. Each awaits its call, and each asserts on
the captured request body or the returned boolean — none is a no-op assertion.

**Is the clamp assertion meaningful?** `assert.ok(body!.content.length <= MAX_CONTENT)` compares
against the imported constant rather than a hard-coded 2000, so the test tracks the constant. It
would fail if `clampContent` were removed (5000 > 2000) or if the truncation notice pushed the result
over (the notice length is subtracted before slicing, so 1986 + 14 = exactly 2000). The companion
`assert.match(body!.content, /truncated/)` pins that the cut is *marked*, which is the part that
keeps a truncated answer from reading as a complete one.

**Does test 4 actually reach the limit?** Yes, and it is worth checking rather than assuming: 40
items, each line `• #<i> a fairly long pull request title that repeats <40 x's> — https://github.com/acme/repo/pull/<i>`
is roughly 130-135 characters, so the unclamped batch is ~5.3k characters — comfortably past 2000, so
the assertion is exercising the clamp and not passing vacuously. Good.

**Cross-module import.** The test imports `postInterventionsDiscord` from `interventions.js`, which
pulls in `../store/index.js` and the git/gh readers. That is a heavier import graph than a transport
test needs, but it is what makes test 4 an integration check of the real formatter rather than a
re-implementation of it. Nothing is executed off disk.

**Not covered:** a `Response` with `status: 200` (only 204 and 400 appear) — irrelevant, `res.ok`
covers both; and the boundary where content is *exactly* `MAX_CONTENT` (the `<=` branch of
`clampContent`, which must pass through untouched). A missing boundary test is a coverage gap, not a
bug.

## Functions (low-level)

### `'content over the Discord limit is clamped, with the cut marked (#940)'` (L7)

Captures the body via a `fetchImpl` that JSON-parses `init.body`, returns 204. Asserts delivery is
`true` (204 → `res.ok === true`), the length bound, and the truncation marker. The `String(init!.body)`
cast is safe here because the transport always passes a string body. *Verdict:* correct.

### `'a non-ok response resolves false instead of passing as delivered (#940)'` (L19)

Returns a 400 with Discord's actual "Request entity too large" payload — realistic, and the body is
deliberately unread by the transport. *Verdict:* correct.

### `'a network error resolves false rather than throwing out of a watcher (#940)'` (L24)

The `fetchImpl` throws synchronously inside an `async` function, so it rejects; the transport's
`try/catch` around the `await` catches it. Would also catch a synchronous throw from a non-async
stub, since the call is inside the `try`. *Verdict:* correct.

### `'a long needs-you batch goes through clamped instead of silently posting nothing (#940)'` (L31)

Builds 40 `pr` interventions with long titles, posts through `postInterventionsDiscord`, asserts
delivered and within the limit. This is the regression test for the original defect: before the
clamp, this exact shape produced a 400 and nothing appeared in the channel. It does not assert the
`/truncated/` marker (test 1 owns that) nor that the first items survived the cut — a stronger test
would check the message still begins with `🔔 40 items need you`. Gap only. *Verdict:* correct.

## Bugs found

None found.
