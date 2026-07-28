Pure leaf module holding the stable identity of interventions/activity items and the "only what is new" diff, shared between the daemon's notifiers and the browser bundle.

## Decisions

- A leaf on purpose: `activity.ts`/`interventions.ts` import `node:*` and cannot be reached from the browser bundle; these four functions are pure, so the dashboard re-exports them (via `client.ts`) instead of keeping the copy it used to — the key IS the identity the daemon dedupes on, so a drifted copy silently double-notifies or never notifies, with nothing to type-check. Type-only imports are erased, adding no edge to the graph `client.test.ts` walks.
- `interventionKey`: a PR is its url (survives title edits/re-sorts); `awaiting`/`unpushed` key on project + gate id / run id, since their url is the shared dashboard URL and would collide.
- `activityKey` includes the kind, so one run's `started` and `finished` are two separate announcements, each firing exactly once.
