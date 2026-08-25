# Bug analysis: packages/framework/src/control.test.ts

## Business logic (high-level)

Tests for the control channel, covering: append+watch delivery in order (stop, single pick, multi pick); reset truncation so a previous run's picks never replay, and a post-reset watcher seeing only new entries; the malformed-line filter (non-JSON, unknown kind, empty id, non-string pick — all dropped; empty multi pick delivered); live-chat messages (empty and missing text dropped; extra fields like the retired `via` ignored, B3); the handoff guard (missing rung, unknown rung, and the retired boolean-pair spelling all dropped; a well-formed rung delivered); the merge entry round-trip; and a repo-hygiene test asserting no runtime state under `.the-framework/` is git-tracked (#1298/#1311).

The async pattern is sound: watchers are created with a 20ms poll, `until()` polls a predicate up to 3s and the assertions then check exact `deepEqual` content, so delivery, ordering, and filtering are all genuinely verified (a filter that let a bad line through would change `seen.length` or the deepEqual). Every test closes its watcher and removes its temp dir in `finally`, so no watcher/timer leaks across tests. Watchers started before `.the-framework/` exists rely on `followFile`'s poll backstop (fs.watch on the missing dir throws and is swallowed) — deliberate, and it exercises that production-relevant path.

One cosmetic staleness: the test title at L134 says "a handoff entry needs both booleans", which describes the pre-B5 pair; the body correctly tests the current one-rung contract (and explicitly includes the retired pair as a line that must be *dropped*). Title-only drift — the test asserts the right thing; not reported as a bug.

Timing robustness: `until(() => seen.length === 3)` style predicates plus final `deepEqual` can in principle flake only by timeout on a pathologically slow machine (3s vs 20ms poll — ample). The handoff test appends the three malformed lines before the good one and asserts `seen` deep-equals only the good entry after it arrives; since the tailer delivers in file order, any wrongly-accepted malformed line would appear before it and fail the deepEqual. Sound.

## Functions (low-level)

- `tmpWorkspace()` / `until(check, timeoutMs)` — mkdtemp under tmpdir; a 20ms-step bounded poll that re-checks once after the deadline. Correct.
- `deliver entries in order` — three `appendControl` calls, expects the three entries verbatim in order. Pins both delivery and the pass-through of `by` (`user` / `autopilot`). Correct.
- `resetControl truncates` — appends a pick, resets, asserts the file is empty, then proves a fresh watcher sees only the new `stop`. Matches the fresh-channel-per-agent spec. Correct.
- `skips malformed and unknown lines` — raw appendFile of: non-JSON, `{kind:'reboot'}`, empty id, numeric pick, then the legitimate empty multi pick. Expects exactly the last. Exercises `isControlEntry` branch by branch. Correct.
- `delivers live-chat messages and drops empty ones` — one real message, one empty, one missing text; expects one. Correct.
- `a message needs real text, extra fields ignored (B3)` — the retired `via` field rides along and the entry is still read for its text; note `deepEqual` on `seen` would include the extra `via` property, so the test maps to texts instead — asserting what matters without over-constraining. Correct.
- `a handoff entry needs both booleans…` (stale title) — drops `{kind:'handoff'}`, an unknown rung, and the retired `{push,pr}` pair; delivers `{kind:'handoff',level:'push'}`. Body correct; title stale (cosmetic).
- `isCommittedFrameworkFile(path)` / `no runtime state under .the-framework is tracked` — computes the repo root via `git rev-parse` (skipping gracefully outside a checkout), lists tracked files under `FRAMEWORK_DIR/`, and allows only the committed set (`.gitignore`, `LAYOUT`, `LOGS.md`, `conversations/`, `<user>/agents`). The `rest.split('/')` indexing takes the second segment as `agents` — i.e. `<user>/agents/...` is committed history, matching #313/#857. A guard test with teeth (it fails listing the offending paths). Correct.
- `a merge entry round-trips` — append + watch → `{kind:'merge'}`. Correct.

## Bugs found

None found.
