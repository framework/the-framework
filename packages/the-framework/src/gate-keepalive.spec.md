Holds the Node event loop open while the run is parked on the user (#1359): a ref'd (but idle) interval that exists only while at least one held promise is pending.

## TLDR

- `createGateKeepalive(timers?)` → `hold(promise)` passes a parked wait through, holding the loop until it settles (resolve or reject); `held()` counts pending holds.
- Counter-based: the first pending hold starts one ref'd idle timer, overlapping holds share it, the last to settle stops it — the process can exit the moment nothing is parked.
- `nodeKeepaliveTimers` is the real seam (a ref'd no-op `setInterval` at `2**30` ms — the tick never matters, only the ref); tests inject `KeepaliveTimers` and assert `hasRef()` on what `start()` returns.
- Wired in `cli.ts` around the two parked waits: the `requestChoice` resolver promise and the live-chat queue's `next()`.

## Problems

- The #1359 death: a daemon-spawned run has nothing ref'd at a parked gate — spawned detached with all stdio ignored and `--no-dashboard` (no server), the claude-code driver spawns/reaps a child per prompt (nothing runs between turns), and the control watcher is deliberately unref'd (#344). Parking a bare Promise emptied the event loop and Node exited 0 mid-await: no `end` event, empty stderr, and picks appended to `control.jsonl` that nothing would ever read. Same silently-unwired-channel family as #905/#922, one layer down — the channel was wired, but the process waiting on it was not held.

## Decisions

- The narrow inverse of the watcher's unref, not its reversal: waiting for an answer IS the run's work at that moment, so the loop is held exactly there and nowhere else. The watcher itself stays unref'd — an always-on ref is what caused the actions-abort hang its unref fixed.
- A Stop releases the holds without special-casing: aborting resolves every parked choice and closes the message queue, which settles the held promises.
