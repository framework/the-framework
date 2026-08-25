# Bug analysis: packages/framework/src/routine-locks.test.ts

## Business logic (high-level)

Six tests over `routine-locks.ts`: five against an in-memory data checkout behind a fake funnel, and one
end-to-end against real git with two clones of one bare origin.

The fake (`checkout()`, L24-49) is the interesting piece. It backs `read`/`write`/`remove`/`list` with a
`Map` keyed by absolute path under a fixed `DATA` dir, records the commit message only when the disk map
actually changed, and — via `opts.runs` — can run the op N times to simulate the funnel's re-run after a
lost push race. `now` is pinned to `T0`, which is what makes the "own claim seen again" identity check
(host + exact `since`) deterministic. `list` mimics the real `readdir` contract by returning basenames of
keys under the directory, so the `*.lock.md` filter in the source is exercised for real.

What the tests actually pin down:

- Lock file shape and round-trip, and that non-lock content names no holder (L51).
- Acquire mints through the funnel with exactly one commit message, and a second run of the same op
  finds the lock ours rather than re-writing it (L59) — the re-runnability invariant.
- An alive lock stands the caller down with the holder named, and nothing is written; and this
  machine's own lock from an earlier run also stands it down (L66).
- The expiry boundary is inclusive at exactly `ROUTINE_LOCK_TTL_MS`, and one minute inside it still
  holds (L79).
- Release drops only this machine's lock; someone else's stands; a missing lock is a silent no-op with
  no commit (L91).
- The boot sweep releases this machine's locks whose run is gone, keeps one whose run is still going,
  never touches another machine's, ignores `README.md`, and commits with the singular count (L106).
- Real git (L140): the laptop's lock reaches origin's `tf-data`; a second clone reads it and stands
  down with the holder named; the desktop cannot release what the laptop holds; the laptop's release
  reaches origin and the desktop's next attempt then takes the lock.

Do the tests verify what they claim? Yes, with one nuance worth stating: the "re-run of a raced push"
test simulates only the *benign* re-run (our own write still on disk). The fake funnel cannot express
the other half of the real mechanism — `syncCore` hard-resetting to origin so a rival's lock replaces
ours between runs — so the "a lock another machine minted meanwhile is found, not overwritten" clause of
the acquire doc is covered by the real-git test's cross-machine assertions only, not by a race. That is a
coverage gap, not a false assertion.

Second coverage gap: the fake funnel always returns `{ ok: true }`, so neither the
`{ ok: false, committed: false }` branch ("the … lock could not be committed") nor the
committed-but-unpushed log line of `acquireRoutineLock`, nor `releaseRoutineLock` returning `false`, is
ever exercised. Those are exactly the branches `daemon-services.ts` L226-231 logs a retry for.

The real-git test's cleanup is `try`/`finally` with `maxRetries: 10` removes, and every assertion is
awaited (no floating promises, no `assert` inside an un-awaited `.then`), so it cannot pass vacuously.

## Functions (low-level)

- `checkout(files, opts)` — builds the in-memory disk, the fake funnel, the deps and a `lock(name)`
  reader. `changed` is computed as "size differs or any value differs", which correctly treats a
  rewrite with identical bytes as no change (mirroring `git status --porcelain` being empty). `read`
  throws for a missing key, matching `readFile`'s ENOENT so the source's `.catch(() => '')` is really
  exercised. `list` uses `key.slice(dir.length + 1)` on `startsWith(dir + '/')` keys, giving basenames.
  Correct.
- `initRepo(prefix, email)` — temp repo with `main`, identity configured, one commit. `realpath` is used
  so macOS `/var` → `/private/var` symlinking cannot make path comparisons fail. Correct.
- Test L51 (`the lock file names the machine and the mint time`) — pure, three real assertions.
  Correct.
- Test L59 (`acquire mints … re-run … still ours`) — `runs: 2`; asserts the result, the file content
  (with the pinned `T0` timestamp) and that exactly one commit message was produced. If the identity
  check regressed, run 2 would rewrite the same bytes and `changed` would still be true from run 1 — so
  the message-count assertion alone would not catch it, but a regression that *stood the caller down* on
  its own claim would flip the first assertion. Adequate.
- Test L66 (`an alive lock stands the caller down`) — exact reason string for another machine's lock,
  plus `messages.length === 0`; the "this machine's own earlier run" half only asserts `.ok === false`.
  Correct.
- Test L79 (`older than four hours is dead`) — takes over at exactly the TTL and refuses one minute
  inside it, pinning the inclusive boundary. Correct.
- Test L91 (`release drops this machine's lock only`) — three checkouts: ours (removed, message
  recorded), theirs (left standing), none (returns `true`, no message). Correct.
- Test L106 (`on boot …`) — `stillRunning` is a string-range predicate over ISO timestamps, matching how
  `daemon-services.ts` answers it; covers the running-run keep, the foreign-host skip and the non-lock
  file skip in one commit, and asserts the singular message. Correct.
- Test L140 (real git, two clones) — the only test that proves the claim actually crosses machines: it
  reads origin's `tf-data` blob directly rather than trusting either checkout. Correct.

## Bugs found

None found.
