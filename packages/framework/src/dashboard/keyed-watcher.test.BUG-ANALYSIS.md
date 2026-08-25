# Bug analysis: packages/framework/src/dashboard/keyed-watcher.test.ts

## Business logic (high-level)

Pins the notification engine's announce/keep-quiet decisions, matching its test SPEC point for point:

- first whole read = silent baseline; a later appearance announces once, then never again (`SeenTracker` test L22, watcher test L40);
- identity is the caller's: `started` and `finished` for one agent are two announcements (L32, using the real `activityKey`);
- a failed scan/projection announces nothing (L64) and does not count as the baseline (L85);
- a *successful but empty* poll with `whole: []` is not a baseline either (#1623, L111) — the realistic boot-without-GitHub shape, since the reads underneath forgive their own failures;
- the baseline is per project: an unreadable project neither floods on recovery (L134) nor silences the readable one, which keeps announcing (L165).

The tests use the real key functions (`interventionKey`, `activityKey`) rather than stubs, so the identity contract is exercised end-to-end. All polls are driven via `watcher.poll()` — deterministic, no timers, matching the E4 design. Each test wraps in try/finally with `watcher.stop()`.

Verification quality: assertions are on concrete announced sets (`deepEqual` on arrays), so they can fail; async paths are awaited. What is *not* covered: overlap suppression (`running` guard), stop-mid-announcement, and within-batch duplicate keys (the bug found in keyed-watcher.ts — no test has the same key twice in one poll, which is why the double-announce slipped through). Coverage gaps, not test bugs.

## Functions (low-level)

- **`pr(n, url, project)` / `started` / `finished` helpers** — minimal `Intervention`/`Activity` literals; `projectOf` mirrors production `scopeOf`. Correct.
- **Test "SeenTracker seeds a baseline…"** — three observes: baseline empty, `[2]`, empty. Exercises key stability (`pr(1,'u1')` re-created per call → key is the URL, not object identity). Correct.
- **Test "keys on the caller's identity"** — `started('r1')` baseline, `finished('r1')` announced (different key), repeat silent. Correct.
- **Test "announces only items that appear after the first poll"** — `onNew` pushes synchronously (`void announced.push(...)`); `current` mutated between polls. Correct.
- **Test "yields no new items when the scan or the projection fails"** — `projects` throws before `build` would; the single `catch` in poll covers both — asserting only "no announcement" is exactly the observable contract. Correct.
- **Test "a failed first poll does not seed the baseline"** — poll fails, then two good polls both silent (pre-existing item is baseline, then seen). Correct.
- **Tests for #1623 (empty-whole, per-project baseline, readable-keeps-announcing)** — each asserts the announced arrays across staged reachability flips; the `whole` lists model exactly what `buildActivity`-style projections report. Correct.

## Bugs found

None found. (Noted coverage gap: no test feeds two same-key items in a single poll, so the within-batch duplicate-announce bug in `SeenTracker.observe` is unpinned; see keyed-watcher.BUG-ANALYSIS.md bug 1.)
