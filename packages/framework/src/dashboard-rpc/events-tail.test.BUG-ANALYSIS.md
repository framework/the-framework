# Bug analysis: packages/framework/src/dashboard-rpc/events-tail.test.ts

## Business logic (high-level)

Eight `node:test` cases over the two exports of `events-tail.ts`, all driven against a real temp
directory and real `fs.watch`/poll timing (no fake clock, no injected fs). Five pin `tailEvents`
(fixed path), three pin `tailAgentEvents` (relocating path). Per `events-tail.test.SPEC.md` the
behaviours under test are: replay-then-follow, same-length-rewrite detection (#567), malformed-line
tolerance + silence after `stop()`, the end-of-replay marker's position (#1383) including the
no-file case, and — for the relocating tail — every event exactly once across a move, no replay of
an already-consumed journal at its new home, and idling while the resolver cannot name the new home.

Timing is the load-bearing part of these tests. `POLL_MS` is 1000 in the module, so every case that
expects the poll backstop (rather than `fs.watch`) to notice something sleeps 1300–1600 ms; the
seeding assertions sleep 150–200 ms, which is generous for one `open`+`read` of a two-line file.
The comments say the long sleeps exist because `fs.watch` is unreliable on CI — i.e. the tests are
written to pass on the poll alone, which is the right call and makes them deterministic rather than
watch-dependent. Total wall time is ~9 s for the file; that is the cost of testing a real tail.

Three structural notes on what the suite does and does not pin down:

- **Every case cleans up.** `stop()` runs in `finally` (case 3 calls it inside the body, which is
  fine — it is the subject of the assertion, and the tail holds nothing but an interval + watcher
  that `rm` of the directory cannot leak past process exit). No case leaves a `followFile` running.
- **The relocation cases are order-tolerant on purpose.** Case 6 compresses "final appends + move"
  into one breath and asserts only the union of what must arrive; whether the watcher saw the
  appends before the `rename` is scheduling luck, and both interleavings are legal. That is a
  strength: it is exactly the production race, and both paths are asserted to converge.
- **Two cases assert an absence.** Case 7 ("does not replay") and case 8 ("stays put") mostly assert
  that `seen` did *not* grow wrongly. Case 7 has real power — the #567 same-length-rewrite reset it
  guards against would duplicate both lines — but it never asserts that the relocation *happened*,
  so a regression that stopped relocating entirely would leave it green (case 6 is what covers
  that). Case 8 is the weaker of the two; see the bug list.

The suite does not exercise the one production shape `events.ts` layers on top: a resolver that
answers `undefined` *permanently* (deleted session), and a resolver whose answer changes while the
current file still exists (a continuation restoring the journal into a fresh checkout). Both live in
`events.ts`, and the second is a real gap — recorded in `events.BUG-ANALYSIS.md`.

## Functions (low-level)

### `line(message)`
Builds one JSONL record `{kind:'log',message}` + `\n`, typed `satisfies FrameworkEvent`. Case 2
depends on `line('old-run')` and `line('new-run')` being byte-identical in length and asserts it
explicitly (L43) rather than trusting the eye — good, that assertion is what keeps the #567 case
honest if the event shape ever changes. Correct.

### `sleep(ms)` / `tmpWorkspace()`
Plain timer promise; `mkdtemp` under `os.tmpdir()`. On macOS `tmpdir()` is a symlink
(`/var` → `/private/var`), which matters for tests that compare paths — none here do; the tail only
ever `open`s and `existsSync`es the path it was handed. Correct.

### Case 1 — `tailEvents seeds ... then follows appends`
Writes one line, subscribes, asserts the replay at 150 ms, appends, waits out a full poll, asserts
both lines. Verifies replay + append-following. The comment (L25–28) explains why `appendFile` and
not `writeFile`: a rewrite would truncate and trip the #567 reset, which case 2 owns. Correct.

### Case 2 — same-length rewrite (#567)
Seeds `old-run`, sleeps 20 ms so the rewrite's mtime lands strictly after the seeding read's
`lastMtimeMs`, rewrites to an equal-length line, asserts both lines were delivered. This is the
only test of `JsonlTailer`'s `size === offset && mtimeMs > lastMtimeMs` branch reachable through
this module. The 20 ms guard is real: with a coarse-mtime filesystem (HFS+ 1 s granularity) it
would still be flaky, but on ext4/APFS (ns/µs mtimes) 20 ms is ample. Correct.

### Case 3 — stop + malformed lines
Seeds one good and one unparseable line, asserts only the good one arrives (the `JSON.parse` catch
inside `JsonlTailer.pull`), then stops and rewrites the file with an extra line, asserting nothing
more arrives. The rewrite is the strong form of the check: after `stop()` the tailer is not merely
"not appended to", the file both shrinks-then-grows and gets a new mtime, so any surviving poll or
watcher callback would deliver `after-stop`. Can fail; asserts what it claims. Correct.

### Case 4 — replay boundary position (#1383)
Asserts `['first','second','<sync>']` and then that `third` lands after the marker. This pins both
halves of the contract: the marker comes *after* the whole replay and *before* the follower starts
(`tailEvents` calls `onReplayed()` inside `follow()`, before `followFile` is created, so no appended
line can precede it). Correct.

### Case 5 — replay boundary with no file
No file is ever created; asserts the marker still fires. Pins the "best-effort" branch —
`tailer.pull()` swallows the `open` failure and resolves, so `follow` (and with it `onReplayed`)
runs anyway. Correct.

### Case 6 — `tailAgentEvents` follows into the archive
The core case. Resolver = "live file if it exists, else archive". Asserts (a) the replay, (b) all
four lines exactly once after `appendFile` + `rename`, (c) `sync === 1`. (c) is the assertion that
pins "a relocation is not a new replay boundary" — `tailAgentEvents` only calls `onReplayed` from
`replayed`, never from `relocate`, and this is what would catch a refactor that moved it. Note the
test uses `rename` (atomic, the old path vanishes instantly) where production copies then removes;
both produce the same observable "path gone" the tail keys on. Correct.

### Case 7 — no replay of a fully-consumed journal after the move
`copyFile` + `rm` reproduces the exact shape that trips #567 at the new home: same length as what
was consumed, newer mtime. Without `retarget`'s `adoptMtime` suspension the first post-retarget
`pull` would reset the offset and re-deliver both lines, and the assertion would fail with
`['one','two','one','two']`. Real power, correctly aimed. Its blind spot: it does not assert the
move occurred, so "relocation stopped working" also passes here. Acceptable — case 6 owns that.

### Case 8 — `stays put while the resolver has no better answer`
Resolver answers `undefined` while `archiveVisible` is false. The flow: append `two` to the live
file, copy to the archive, remove the live file, sleep 1300 ms (a full poll with the resolver
answering `undefined`), flip `archiveVisible`, sleep 1600 ms, assert `seen === ['one','two']`.
It does verify the *catch-up* half (and would catch a double-delivery at the new home), but it
never asserts anything during the `undefined` window, and the setup contains no "wrong file" to hop
to — so the half its name and its SPEC line claim ("idles instead of following the wrong file") is
not observable by this test at all. Worse, the two interleavings are indistinguishable in the final
state: if `fs.watch` fires between `appendFile` and `rm`, `two` is delivered from the live file and
the relocation-after-`undefined` path is never exercised, yet the test passes identically. Verdict:
suspicious — passes for the right reason only some of the time. See bug 1.

## Bugs found

1. **L186–215 (`tailAgentEvents stays put while the resolver has no better answer`): the test does
   not pin the behaviour it names, and can pass without ever exercising it.** There is no assertion
   inside the `undefined` window (between L207's sleep and L208's `archiveVisible = true`), so
   "the subscriber idles instead of following the wrong file" — `events-tail.test.SPEC.md` L9 — is
   never observed; the only assertion is the final `seen` at L210. And because `appendFile(live)`,
   `copyFile` and `rmFile` happen back to back at L204–206, an `fs.watch` event landing between the
   append and the remove delivers `two` off the *live* file, after which the whole
   resolver-answers-`undefined` path is dead code for that run and the final assertion still holds.
   Concretely: a regression where `relocate` forgot the `next === undefined` guard and retargeted to
   `undefined`/`String(undefined)` would still leave `seen === ['one','two']` on any run where the
   watcher won the race. Severity: minor (test quality, no production behaviour at risk).
   Confidence: high for "does not assert the idle", medium for "passes for the wrong reason"
   (depends on watcher timing). Fix: assert inside the window — after L207 add
   `assert.deepEqual(seen, ['one'], 'nothing is delivered while the new home is unresolvable')`
   and move the `appendFile` to *after* the live file is gone (append to `archive` instead), so the
   only route by which `two` can arrive is the relocation this case exists to test.
