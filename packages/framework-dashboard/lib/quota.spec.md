Polling hooks for the usage panel's data (#535): `useQuota()` and `useAutoPm()` ask the daemon every 30s for its cached readings via Telefunc + `usePolled`.

## TLDR

- The daemon polls the agent and caches the answer, so these reads are cheap — no agent is spawned per request. Prerender has no daemon, so both start empty and load on the client.
- Both are `undefined` until the first answer; a failed call keeps the last view rather than blanking it (an empty bar would read as "nothing used").
- `useAutoPm` (#1161) is polled rather than read once: the sweep runs on the daemon's clock, not the browser's, so the panel finding out is a matter of asking again; `undefined` on a host with no sweep.
