The run store: an append-only `events.jsonl` as the single source of truth, with `run.json` as a derived snapshot and the meta as a pure projection of events.

## TLDR

- One pure reducer folds an event into the meta; replaying a whole log through it rebuilds the meta from scratch; `append` folds the same function — so there is no separate state model to keep in sync, and the remote-run mirror reuses the identical reducer.
- All appends chain through a single tail promise so an append and its meta rewrite never interleave; persistence failures are logged, never thrown — they must not break a live run.

## Decisions

- One deliberate impurity: a continued run keeps its original intent label even though the resumed bootstrap's scope event carries the resume message and would relabel the row.
- **Orphan healing**: a run whose process died without an `end` event gets a synthetic `{end, ok:false, stopped:true}` appended *and* folded — every reader keys "over" off a single end event, and a death that skipped it left the run's last question rendering as answerable forever.
- Liveness is a three-state answer (alive / gone / unknown), and the two callers treat `unknown` differently **on purpose**: boot reconciliation settles it to stopped; the self-heal-on-read path leaves it alone, because a routine read must not kill a run another machine may own. Reconciliation also refuses to touch a pid that is alive on this host — a second daemon booting must not orphan the first one's runs.
- Two archive locations, both read, committed copy winning on dedup: a transient gitignored `runs/` (a `git clean -fdx` used to delete every session a project ever ran) and the committed per-user `<email>/sessions/` (per-user so two people on one repo don't conflict on every merge).
- "All runs" = live prepended to archived, live winning — a continued run has an archive *and* is live again, and the old archive-wins rule showed a running run as finished.

## Facts

- `settledAt` is deliberately not a run status — a settled run is still alive as a conversation.
- The handoff report is only trustworthy at meta version ≥ 2; in older records its absence must not read as "publishing forever".
- The browser-stream port is deleted on end, so the dashboard pane is never pointed at whatever the OS hands that port next.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
