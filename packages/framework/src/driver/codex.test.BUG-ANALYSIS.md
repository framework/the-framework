# Bug analysis: packages/framework/src/driver/codex.test.ts

## Business logic (high-level)

Unit tests for the Codex driver. Two layers are exercised, both against `REAL_RUN` — a verbatim
capture of a codex-cli 0.144.4 session — which is the file's main asset: the dialect assumptions in
`codex.ts` are pinned to real output rather than to an invented shape, so a CLI dialect change
breaks a test instead of silently degrading a turn.

Behaviours pinned:

- **Parser semantics** — the *last* `agent_message` is the turn answer while every message is
  streamed (L19-36); tool use surfaces as its kind only, with no arguments anywhere in the emitted
  events (the `deepEqual` on the whole event list at L31 is what makes this airtight — an extra
  event or a leaked argument fails it); non-event output is ignored (L86-92).
- **Usage mapping** — the exact arithmetic of #540: cache subtracted out of the inclusive input
  total (L38-63), reasoning tokens not double-counted (L65-70), no `costUsd` key at all
  (`'costUsd' in usage === false` at L50 is the assertion that actually enforces "never a zero
  cost"; `usage?.costUsd === undefined` alone would pass for `{costUsd: undefined}`), and malformed
  payloads degrading to `undefined`/zeros rather than `NaN` or a negative input count (L72-84).
- **Process wiring** — argv is asserted as a whole array (L135) rather than by membership, so an
  accidental extra flag fails; the bypass flag's absence and `--skip-git-repo-check`'s presence are
  additionally asserted by name, which is redundant but documents intent; the prompt travels over
  stdin *and* is asserted absent from argv (L150); framing order is `session, per-call, prompt`
  (L158); the model is threaded through (L166).
- **Omissions as contract** — `readQuota === undefined` (L169-174) turns "Codex cannot report a
  quota" into a checked property rather than a comment.
- **Failure** — a non-zero exit rejects even though text streamed first (L176-181). Worth noting
  this test would still pass if the rejection came from the wrong layer, but the message regex
  `/codex exited \(1\)/` ties it to `runCliSession`'s wording and to the `driver: 'codex'` label,
  so it does verify the driver name is threaded.

**Do the tests verify what they claim?** Yes; each assertion is falsifiable against a plausible
implementation error. The one genuine *coverage* gap is that "ignores noise that is not an event"
tests only unparseable noise (`Reading additional input from stdin...`, `''`) and a known-but-empty
event (`turn.started`), never a line that parses to a non-object — which is exactly the input that
crashes `CodexJsonParser.push` (filed against `codex.ts`). A missing case is not a bug in the test
file, but it is the reason the production defect is unpinned. Similarly untested: abort/signal
handling and `readCode` — both live in `cli-session.ts` / `session-support.ts` and are covered by
those files' own tests, so the omission is deliberate layering, not a hole.

## Functions (low-level)

- **`REAL_RUN` (L9-17)** — seven verbatim lines, `JSON.stringify`-ed so the fixtures cannot drift
  into invalid JSON. Contains a non-ASCII curly apostrophe in the first message, which incidentally
  exercises UTF-8 through the fake stream. Verdict: correct.

- **`fakeSpawn(lines, onSpawn?, code=0)` (L95-117)** — returns a `SpawnLike` producing a
  `SpawnedProcess` whose stdout is a single-chunk `Readable`, stderr is empty, and stdin is a
  `Writable` accumulating into `written`. `on('close')` is implemented by hanging the listener off
  stdout's `'end'`, which orders the close *after* all output is parsed — matching a real child,
  where `'close'` fires after the stdio streams end. `on('error')` is silently ignored (the `if`
  only matches `'close'`), which is fine: no test drives a spawn error. Ordering check: the
  callback reads `written`, and `runCliSession` writes stdin synchronously at the end of its
  constructor body (L178) while `'end'` can only fire on a later tick, so `written` is always
  complete when observed — no flake. The returned `proc` is referenced inside its own object
  literal method, which is legal because `on` is only called after construction. Verdict: correct.

- **Parser tests (L19-92)** — analyzed above. Note L21 and L30 each build a *fresh* parser, so no
  cross-test state. Verdict: correct.

- **`parseCodexUsage` tests (L53-84)** — cover the inclusive-input case, the reasoning-subset case,
  `undefined`, a string, `{}`, and the cache-exceeds-input clamp. The clamp case asserts
  `cacheReadTokens: 10`, i.e. the clamped value, pinning the deliberate choice to trust the smaller
  figure. Verdict: correct.

- **Driver tests (L119-181)** — each awaits its promise; the rejection test uses
  `assert.rejects(() => …)` with a regex, so it cannot pass on a resolved promise or on an
  unrelated error. No test forgets an `await`. Verdict: correct.

## Bugs found

None found.
