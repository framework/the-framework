# Bug analysis: packages/framework/dashboard/components/ActionsRunNotice.tsx

## Business logic (high-level)

A one-purpose banner for agents on the `actions` run target: because a GitHub Actions run replays
its whole transcript in one burst at the end, the live feed looks stalled, so this says the wait
is expected ("updates arrive when the run finishes.") while `live`, drops that clause once
finished, and links out to the Actions run once its URL is known. For every other target
(`local`, `remote`, `web`, or unset) it renders `null`, so `AgentView` can mount it
unconditionally — the whole gate is the first line.

The URL comes from `actionsRunUrl(events)` (lib/live-state.ts L174-182): the last driver
`action` event whose label matches `^run (https?:\/\/\S+)$`. Last-match-wins means a resumed
agent that produced a second run points at the newest one; absence before the driver reports the
run renders no link, which the SPEC calls out. The events prop is the same shared stream the
shell owns, so a tab opened mid-run still finds the URL in the replay.

Edge cases: an empty events array → no link (correct); malformed labels are filtered by the
anchored regex; the link opens in a new tab with `rel="noreferrer"` (no opener leak);
`role="status"` makes the notice announce politely. There is no state, effect, or subscription —
nothing to leak and no ordering to get wrong.

## Functions (low-level)

- **`ActionsRunNotice({ target, events, live })`** — gate on `target !== 'actions'` → `null`;
  derive `url`; render the sentence with the live-only clause; conditionally render the anchor.
  Inputs: `target` optional union, `events` readonly array, `live` boolean. Output: `null` or a
  status row. Edge analysis: `live` toggling from true to false mid-mount simply re-renders the
  shorter sentence (no remount, matching the app's live-and-finished-look-the-same rule); a URL
  arriving in a later event batch re-renders the link in place. Verdict: correct.

## Bugs found

None found.
