# Bug analysis: packages/framework/dashboard/lib/notify-channels.ts

## Business logic (high-level)

Module-scoped shared cache of `onNotifyChannels()` (which channels the daemon can deliver on), the #1095 fix: three surfaces (bell, settings rows, Onboarding checklist) read one value; a save calls `reloadNotifyChannels()` so all readers settle together. SPEC invariants:

1. **One answer, shared / one fetch for simultaneous mounts** — `load()` dedupes on `inFlight`; every reader subscribes to the same listener set; `notify()` fans out. Holds.
2. **Not-asked-yet ≠ not-configured** — `cache` starts `null`, hook returns `null` until the first read lands; `NO_NOTIFY_CHANNELS` (`{discordWebhook:false, sources:{}, editable:false}`) is the explicit empty reading for callers needing a value. Holds.
3. **A failed read changes nothing** — `.catch(() => {})` keeps the previous `cache`. Holds (and no `notify()` on failure, so no spurious re-render).

Concurrency analysis of the dedupe: `reloadNotifyChannels()` → `load()` → `if (inFlight) return inFlight`. A reload issued *after a write completes* is supposed to observe post-write state, but if a read is already in flight at that moment, the reload silently joins it — and that read was dispatched *before* the write landed, so the cache can settle on pre-write state with nothing scheduled to correct it (no polling exists in this store by design). Reachable interleaving: two webhook saves in quick succession (save A resolves → reload₁ starts; save B resolves while reload₁ is still out → reload₂ joins reload₁ → B's stored state never re-read). Practically narrow — both callers (`SettingsPage`/`OnboardingChecklist` `onSaved`) fire after a modal save, and the mount-time load has long settled by then — but it is a real ordering hole in the very guarantee the module exists for ("a save re-reads it for all of them at once"). Recorded as a low-confidence bug below.

Lifecycle: listeners added/removed symmetrically; the `useEffect` with `[]` triggers the initial load only when `cache === null`, so a component mounting after a failed initial load retries (cache still null) — good. Module state persists across route changes, intended.

## Functions (low-level)

- `notify()` — snapshot is the `cache` reference itself; `cache = next` swaps identity so `useSyncExternalStore` re-renders. Correct.
- `load()` — dedupe + adopt + swallow + clear `inFlight` in `finally`. The `.catch(() => {})` placed before `.finally` also prevents unhandled rejections for the `void load()` callers. Correct except the reload-joins-stale-read ordering above.
- `reloadNotifyChannels()` — thin wrapper; inherits the dedupe hole. Suspicious-but-unproven in practice (see bug 1).
- `useNotifyChannels()` — subscribes, returns `cache` (null until first read); server snapshot `null` (prerender has no daemon). The effect runs after `useSyncExternalStore` has subscribed, so a load resolving between render and effect still notifies the subscribed listener; and `useSyncExternalStore` re-checks the snapshot on subscribe, closing the remaining gap. Correct.
- `EMPTY` / `NO_NOTIFY_CHANNELS` — frozen-by-convention constant (not actually frozen; nothing mutates it). Correct.

## Bugs found

1. `L31` (`load`'s `if (inFlight) return inFlight` as used by `reloadNotifyChannels`): a reload requested while a previous read is still in flight is deduped into that older read, so a credential saved during that window is never re-read and every surface keeps showing the pre-save state indefinitely (no poll exists to self-heal — the polls were removed by #1095). Trigger: save a Discord webhook twice in quick succession (second save resolves while the first save's reload round-trip is still out). Contradicts the SPEC's "Saving a credential re-reads it immediately, so every reader settles on the new state". Severity: minor. Confidence: low (the window is one RPC round-trip and both call sites sit behind a modal). Fix sketch: have `reloadNotifyChannels` mark a `dirty` flag when a read is in flight and issue one fresh read from `load`'s `finally` when the flag is set (or track a generation counter and re-issue when the finished read's generation is stale).
