# Bug analysis: packages/framework/src/driver/cli-session.ts

## Business logic (high-level)

The shared process engine for one CLI turn (`runCliSession`): spawn the wrapped CLI detached (own process group), feed the prompt over stdin, stream stdout lines through the driver's parser into events, collect stderr raw, and settle the turn on exit — non-zero exit fails the turn even when text streamed first. Abort wiring: pre-check all signals, register an abort listener per signal, on abort SIGTERM the group then SIGKILL after a 5s grace. Every turn is reported exactly once (`settled` + `finish`), and a late `close` after an abort emits no second telemetry.

Behavior checked against its SPEC bullet-for-bullet:

- *Prompt over stdin, never argv* — `child.stdin.write(prompt); end()`. ✔
- *Streamed output* — readline per line → `parser.push` → emit. ✔ Probe confirmed Node's readline flushes an unterminated final line before the child's `close` event, so the last `result` line is always parsed before `parser.result()` is read.
- *Whole-tree stop + 5s grace* — `detached: true`, `killTree(-pid)` SIGTERM → SIGKILL timer (unref'd; the exit hook covers a daemon death in the window). ✔
- *Failed exit = failed turn, detail from stderr → partial text → exit code* — ✔, and stderr is accumulated as Buffers and decoded once (multibyte-safe). ✔
- *Reported exactly once* — `settled` guard; abort and spawn-error paths remove listeners and the late `close` returns after `cleanup()`. ✔ (test pins it)
- *Early-death EPIPE swallowed* — no-op `stdin.on('error')`; the close handler reports the turn. ✔ (two tests, one with a real 1 MB pipe write)

Ordering/race analysis:

- Pre-aborted signal → reject before `start` is emitted or anything spawns. Listeners registered after the synchronous spawn — no interleaving window exists in single-threaded JS (aborts only fire from callbacks).
- Two signals aborting: first handler settles and `finish` removes all listeners, so the second never runs; `terminate` runs once, so only one hard-kill timer exists; `cleanup` on the eventual `close` clears it.
- `error` then `close` both firing (spawn failures): settled-guarded, `cleanup` idempotent (`clearTimeout(undefined)` fine, Set delete idempotent).
- Abort path calls `terminate` but not `cleanup` — correct: the child is still alive; `cleanup` runs when `close` finally fires, unregistering the pid; if `close` never fires the exit hook reaps.
- Parser exceptions: a `parser.push` throw inside the readline `'line'` listener would be an uncaught exception (no daemon-level handler exists). This engine trusts parsers never to throw; both real parsers have a null-line hole — recorded against `claude-code.ts` / `codex.ts`, where the parsers live.
- Emit exceptions: `opts.emit` is trusted; all drivers pass `makeEmit`-wrapped sinks. Reliance noted.

Edge cases:

- `pid == null` (in-memory fakes): kill falls back to `child.kill`, registry skipped. ✔
- `code === null` (killed by an outside signal, no abort of ours): treated as non-zero → failed turn `exited (null)`, which is the honest outcome. ✔
- Empty prompt: written and ended; fine.
- `dispose`-mid-prompt is not this file's concern; sessions await `prompt` before disposing (see claude-code analysis).

## Functions (low-level)

- **`runCliSession(opts)`** — the whole engine, analyzed above. Verdict: correct.
- **`terminate()`** — group-kill with fallback; sets the unref'd SIGKILL timer. Called at most once (settled-guard upstream). Verdict: correct.
- **`cleanup()`** — unregister + clear timer; idempotent. Verdict: correct.
- **`finish(fn)`** — once-guard + abort-listener removal, then settle. Verdict: correct.
- **Types (`SpawnLike`, `SpawnedProcess`, `AgentCliParser`, `RunCliSessionOptions`)** — minimal slices; `on` only models `close`/`error`, which is all the engine uses. Verdict: correct.

## Bugs found

None found. (The parser null-line crash that this file would propagate as an uncaught exception is filed against `claude-code.ts` and `codex.ts`, where the defect lives.)
