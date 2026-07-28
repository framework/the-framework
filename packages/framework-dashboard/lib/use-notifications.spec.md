Browser notifications for the two feeds the shell already polls (#627) — `useInterventionNotifications` (the "needs you" queue) and `useActivityNotifications` (run started/finished) — one generic engine plus a per-feed `NotificationSpec`.

## TLDR

- The identity half (`keyOf` + `pickNew`) is imported from `@gemstack/the-framework/client` (`interventionKey`/`pickNewInterventions`, `activityKey`/`pickNewActivity`) — the same code the daemon's Discord notifier runs, so the two surfaces cannot drift (#935 unified the server side; this is the client side of the same move). What differs per feed is wording and click target, i.e. the spec.
- Gates: fires only when `enabled` (category toggle AND browser method, folded by the caller) AND `Notification.permission === 'granted'`; no-op on the server / unsupported browsers.
- `WARMUP = 2`: the first two observations (the initial `[]`, then the first fetch of already-known items) are absorbed as baseline — you only hear about things that happen while watching, never the backlog present at page load.

## Decisions

- Click routing: a PR opens its GitHub URL in a new tab; an `awaiting` (paused run, body shows its question #636) or `unpushed` (#860, body says how many commits sit unpushed) item lives in this dashboard, so the click just brings the tab forward (project selection is client state, not a URL).
- One notification per batch: title from the first item (+ count), body joins each item's label with newlines.
- The spec objects are module consts (stable identity), so the effect deps are just `[items, enabled]`.
