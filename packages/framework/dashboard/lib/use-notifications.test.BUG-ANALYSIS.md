# Bug analysis: packages/framework/dashboard/lib/use-notifications.test.ts

## Business logic (high-level)

Tests for the notification hooks. A `FakeNotification` class (static `permission = 'granted'`,
constructor recorded via `ctor`) is stubbed globally per test and unstubbed after, so the
`fire()` permission gate passes and constructions are observable. `read(items, whole=['p'])`
models a poll that reached its projects; `unread()` models the #1625 "we could not look" poll
(`whole: []`). Rerenders drive successive polls — each `read()`/`unread()` call creates a fresh
object, so the hook's `lastRead` identity guard sees a new read each time, matching production.

Coverage vs the test SPEC:
- Baseline absorption then a later PR notifying once, with the "Human Queue" title. Genuine.
- A parked agent (`awaiting`) appearing later notifies with its question in the body (#636).
- Disabled → never fires, across two polls that would otherwise notify.
- #1625: two `unread()` polls are not a baseline; the first real read absorbs both PRs silently;
  a third PR then notifies, and the body names `#3` — pinning both halves (no burst, still live).
- #1623: project `q` never read → `p` keeps notifying (count stays 1 after p's second PR...
  actually the test asserts 1 total: the first poll absorbed p's baseline, the second poll's new
  `item(9)` fires the one notification); q's first whole read (`['p','q']`) absorbs `other(5)`
  silently — the "does not hold back / own backlog still absorbed" pair.
- Toggle-off accumulation then on → nothing replays: the enabled flip rerenders with the *same*
  items array content but a fresh `read()` object; the tracker already saw item 2, so nothing is
  fresh. Note the flip rerender passes a NEW read object (not the same identity), which makes the
  test actually exercise the tracker's seen-set rather than the `lastRead` identity guard — a
  stronger check than the SPEC sentence implies. Good.
- Activity: baseline, started-later notifies with title+body, and started→finished as two
  distinct keys firing twice, second titled "Agent finished".

All assertions are on `ctor` calls (count/title/body), which the code path genuinely drives; no
async is involved (effects run synchronously under `renderHook`'s act), so nothing is left
unawaited. `ctor.mockReset()` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach` keep
tests independent; the hook's tracker is per-render-tree, recreated by each `render(...)` call.

## Functions (low-level)

- `read` / `unread` helpers — shapes match `ProjectionRead<T>`. Correct.
- `item` / `awaiting` / `startedAgent` / `finishedAgent` builders — carry the fields the keys use
  (`url`, `awaitId`, `agentId`, `kind`, `projectId`); `interventionKey`/`activityKey` produce the
  identities the tests rely on (e.g. distinct started:/finished: keys). Correct.
- `render(enabled)` closures via `renderHook` with `initialProps` — the first render observes the
  `unread()` initial props, which is itself a no-baseline poll; deliberate and correct.

## Bugs found

None found.
