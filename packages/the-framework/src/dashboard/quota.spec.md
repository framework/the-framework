The usage panel's quota view (#533): assembles the account's quota windows and their standing against the spend boundary (#879) from a live `QuotaPoller`.

## TLDR

- `QuotaView`: the driver-reported windows (session, week, week-per-model), `readAt`, `unavailable` (why the newest attempt failed — present alongside stale windows so the UI can mark them stale rather than blank), and `boundary` (#879; absent = "we don't know", not "nothing allowed").
- `pollerQuotaSource(poller, now, limitOffset)` wraps a poller as a `QuotaSource`; `defaultQuotaSource()` builds the daemon's own: a `ClaudeCodeDriver` + `QuotaPoller` started immediately.

## Decisions

- The boundary is computed per read, never captured: it moves with the clock, and a cached one would be stale the moment the week's day rolls over. No model is passed — the panel is about the account; a model's own week only narrows the gate for a run that chose one.
- The daemon's source polls for the dashboard's whole life, not just during runs — the panel must show standing while nothing runs. Deliberately separate from the per-run guard, which exists to pause a run and dies with it.
- The `limitOffset` slider position is read per call (so moving it takes effect without restart, #960) and read *here* only — one source, so the bar the user reads and the line auto PM obeys cannot disagree. An unreadable registry means the default policy, which is what a fresh install runs anyway.
- Empty `windows` + `unavailable` must be checked together: empty alone does not mean "nothing used".
