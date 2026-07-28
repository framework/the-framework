`useWorking(enabled?)` — true while any project has a running run (#875), polled every 5s from `onOverview` (`active` = every running run across the registry, #437).

## Decisions

- Cross-project on purpose: the mark answers "is the AI working for you", not "on the project you happen to have selected" — a run left going in another project still counts.
- `onOverview` was already registered with no client, and the Overview page's own `onDashboard` poll is a superset, so this adds no read the daemon did not already serve.
- Stable `IDLE` initial constant so the poll does not churn on every render; `enabled: false` skips the poll and answers false.
