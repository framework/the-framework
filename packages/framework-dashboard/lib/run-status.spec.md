Derives a run's single ranked status pill (`{dot, label, tone}`) from its event stream — shared so the session toolbar and the overview cannot drift on what a run is.

## TLDR

- `runStatusPill(events)` ranks: failed (`failed — <detail>`) > stopped > ready for merge > building… (pulsing, only while live, #695/U20) > finished; `null` while the run has said nothing worth a pill (no session name, no state, not ended).
- Built on `runProgress()` (framework client) plus `runOutcome()`/`isRunActive()` from `live-state.ts`.

## Decisions

- States are deliberately exclusive — one run, one word. A run can hold several facts at once (ready-for-merge then stopped/failed); how it ENDED outranks what it said on the way (#948), else the green "ready for merge" lies about a run that never got there.
