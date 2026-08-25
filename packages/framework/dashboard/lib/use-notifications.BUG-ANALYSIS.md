# Bug analysis: packages/framework/dashboard/lib/use-notifications.ts

## Business logic (high-level)

Browser notifications for the two cross-project feeds (#627): interventions ("needs you") and
activity (started/finished). Identity and baseline logic are imported from the framework
(`SeenTracker`, `interventionKey`, `activityKey`) so browser and Discord notifier cannot drift
(#935/#1623/#1625). Verified against the SPEC:

- **Two gates** — `enabled` (category toggle folded by the caller) gates in the effect;
  `Notification.permission === 'granted'` gates inside `fire()`. Without both, nothing shows.
  `fire` also guards `typeof Notification === 'undefined'`, so unsupported browsers and the
  server are no-ops. Correct.
- **Backlog absorbed, never announced** — `SeenTracker.observe(items, whole)` (read in
  `src/dashboard/keyed-watcher.ts`) only reports items whose project is already `warmedUp`, and
  warms a project only from a `whole` read; items are folded into `seen` regardless. So the #1625
  empty-unreachable-GitHub sequence produces no burst, and a per-project baseline (#1623) keeps
  one unreadable project from muting the rest. Correct.
- **Absorbed while off** — the effect observes on every *new* `read` regardless of `enabled`, and
  only fires when `enabled && fresh.length > 0`. Correct.
- **Toggle flip is not a re-read** — `lastRead` ref compares the `read` object by identity; a
  re-run caused by `enabled` alone returns early. This relies on the caller passing a stable
  object per poll (the shell's poll produces a fresh object per fetch), which holds. Correct.
- **One notification for several items** — title via `spec.title(first, count)`, body one line
  per item. Correct.
- **Click target** — PR opens `window.open(url, '_blank', 'noopener')`; awaiting/unpushed and all
  activity call `window.focus()`. Matches the SPEC's "a click goes where the item lives".
  `notification.close()` after either. Correct.

Lifecycle: `tracker` is created lazily once per hook instance (`useRef` + `??=`); a full remount
(page reload) rebuilds it and re-absorbs the then-current backlog — exactly the intended "only
what happens while you are watching". No listeners or timers owned here, so nothing leaks.

## Functions (low-level)

- `fire(items, spec)` — permission/undefined guard, `items[0]` guard (empty array → no-op; callers
  only pass non-empty, but the guard also narrows types). Builds one Notification; onclick routes
  by `clickUrl(first)`. Multi-item click uses the *first* item's URL — with several new PRs the
  click opens the first; a deliberate simplification, matches the SPEC's wording. Correct.
- `useNewItemNotifications(read, enabled, spec)` — described above. Deps `[read, enabled]` with
  the spec being a module constant; the eslint-disable is justified. Correct.
- `INTERVENTIONS` spec — labels: awaiting → its question title; unpushed → "title — N commit(s)
  not pushed" with the `undefined`/`0` count reading "work not pushed" (SPEC: "or simply 'work
  not pushed' when that count is not known" — treating a *known zero* the same way is the only
  divergence, and a finished agent flagged unpushed with zero commits is not a state the
  producer emits, so this is a non-issue); pr → `#N title`. Titles singular/plural per count.
  Correct.
- `ACTIVITY` spec — title per kind + project for one, count for several; label "Started:/
  Finished:" + title or "a session"; clicks always focus. Correct.
- `useInterventionNotifications` / `useActivityNotifications` — thin bindings. Correct.

## Bugs found

None found.
