Builds the cross-project "New activity" feed (#627): run lifecycle transitions (started/finished) that inform the human but do not need them, plus its Discord formatting.

## TLDR

- `buildActivity(projects)` maps each project's ~20 most recent runs to one `Activity` item each: `started` while the run is `running`, `finished` once terminal (with the terminal status), newest first.
- The default-off notification counterpart to `interventions.ts` ("needs you"); consumed by the browser hook and the Discord watcher through the shared `SeenTracker` baseline-diff, so each transition notifies exactly once.
- `activityLine`/`postActivityDiscord` render items as one Discord webhook message (via `postDiscordWebhook`, #940).
- Re-exports `activityKey`/`pickNewActivity` from `keys.ts` so this stays the import site for the type that declares the kinds.

## Decisions

- `RECENT_RUNS = 20` per project bounds the finished set: older runs were baselined long ago; a running run is always in range because live meta is prepended newest-first.
- A run that starts and finishes between two polls is only ever seen terminal, so it notifies once (`finished`) — one quick run, one line.
- Forgiving: a project whose runs cannot be read contributes nothing.
