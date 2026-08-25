# Bug analysis: packages/framework/src/jsonl-tail.test.ts

## Business logic (high-level)

Five tests pinning exactly the #996 hardening its SPEC claims: a failing read neither kills the process nor stops the tail; a watcher error is absorbed and the poll alone still delivers; `unref: true` releases *both* handles so a real child process exits. Notably the suite does **not** cover `JsonlTailer`'s happy-path incremental parsing (offsets, torn lines, truncation reset, retarget) — those behaviors are exercised elsewhere or not at all; within this file's stated scope ("survives everything that can go wrong underneath it") coverage is complete.

Quality of the tests:

- **Real failure injection, not mocks-of-the-thing-under-test**: EISDIR is produced by tailing a real directory (open+stat succeed, read rejects — precisely the shape pump must absorb); the watcher error is emitted on the *actual* FSWatcher instance captured via prototype interception; the unref claim is proven by an actual child process exiting (the comment is right that asserting "unref was called" would be weaker).
- **`captureWatcher`** patches `on`/`addListener` as own properties on the FSWatcher prototype (shadowing EventEmitter's), records instances, and restores by deleting the shadows in `finally` — even if `create()` throws. Node's `fs.watch` registers its 'change' listener through these methods during construction, so the instance is reliably captured; `followFile`'s own `.on('error')` also lands in `seen`. Sound, if invasive; the restore is complete (deleting the own property un-shadows the inherited original).
- **Timing**: sleep-based with generous margins (pollMs 20 vs waits of 150–300 ms; 3 failing pulls vs `calls > 4` after ~15 poll ticks; child gets 10 s to exit). Flake risk is low; assertions are on the safe side of each margin.
- **Cleanup**: every test stops the tail and removes its tmpdir in `finally`; the child is SIGKILLed on timeout. No leaked watchers/timers between tests.
- **Honesty**: the third test's `assert.ok(true)` looks vacuous but is not — the test's real assertion is "the process is still alive to run this line" after repeated rejecting pulls through the real tailer; an unhandled rejection would have failed the run. The fourth test's two `deepEqual`s on `seen` genuinely verify delivery before and after the watcher's death (the second append can only arrive via the poll since the handler closed the watcher).
- The unref child builds its module URL from `import.meta.url`, so it works from src or build output; `stdio: 'ignore'` keeps no pipe holding the child open — the test isolates exactly the two handles under test.

## Functions (low-level)

- **`line`, `sleep`, `tmpWorkspace`** — trivial helpers. Correct.
- **`captureWatcher(create)`** — described above; asserts a watcher was created. One instance suffices since `followFile` makes exactly one. Correct.
- **Test 1 (pull rejects)** — pins that `pull` itself does *not* swallow read errors (the contract that makes pump's catch load-bearing). Correct.
- **Test 2 (pump absorbs, keeps pulling)** — counts pulls through three failures; asserts continuation. Correct.
- **Test 3 (real tailer over a directory)** — end-to-end survival. Correct.
- **Test 4 (watcher error → poll backstop)** — emit 'error' with no crash, then delivery via poll only. Correct.
- **Test 5 (unref lets the process exit)** — child-process exit code 0 within 10 s. Correct.

## Bugs found

None found.
