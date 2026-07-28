MV3 service-worker half of the Claude web bridge: holds the daemon token, performs every daemon fetch (questions, transcripts, answer polling + acks), and opens/closes pinned tabs for watched cloud sessions.

## TLDR

- Message handlers: `tf-question` (POST `/_bridge/question`, deduped), `tf-events` (POST `/_bridge/events`), `tf-hello` (POST `/_bridge/hello`), `tf-open-now` (run the tab sweep on demand for the options page).
- Answers travelling back (#1237): `pollAnswers` → GET `/_bridge/sessions` → `deliverAnswers` → GET `/_bridge/answer?sessionId=` → `chrome.tabs.sendMessage(tf-deliver-answer)` into the session's tab → POST `/_bridge/answered` ack with the outcome.
- `openWatchedTabs`: opens one pinned, inactive background tab per daemon-watched session (opt-in via `autoOpen`), skips already-open and user-dismissed sessions, closes stale tabs it opened, and records every outcome in `storage.lastOpen`.
- Two alarms drive everything: `tf-sessions` every 1 min (tab sweep) and `tf-answers` every 0.5 min (the floor Chrome allows) — plus one immediate run of each at worker startup.

## Problems

- CORS is the whole reason this file exists: a content-script fetch carries the page's origin and the daemon deliberately answers no CORS headers (a wildcard would let any site the user visits post to their dashboard); a service worker holding `host_permissions` is not subject to CORS. It also keeps the token out of the claude.ai tab.
- MV3 workers are terminated when idle and timers die with them — alarms wake the worker back up, so alarms, not `setInterval`.
- Delivery/ack race: delivery goes tab-first on purpose (acking before typing would mark answers `sent` that a dying tab never sent); the reverse race — delivered but ack lost → re-delivery — is prevented by `deliveredAnswers` for the worker's lifetime and made harmless beyond it by the daemon's own answer id.
- Orphaned content scripts: a tab that can't hear `sendMessage` is either discarded or carries a script orphaned by an extension reload; if it is a tab this extension opened, it is reloaded and retried after 5s — someone else's tab is not ours to reload (it might hold composer text they typed).

## Decisions

- Question dedupe: `lastSent` fingerprint (`[title, options, recommended]`) per session, because the content script re-surveys on every DOM change and a parked question can sit for an hour; failures are NOT remembered, so the next DOM change retries instead of going quiet.
- A successful question report immediately triggers `deliverAnswers([sessionId])`: the page mutating is also when a parked session is most likely to have been dealt with.
- Failed acks queue in `pendingAcks` and retry on the next poll, never dropped — an unacked delivered answer would sit `queued` in the dashboard after being typed into the page; HTTP 400 counts as settled.
- A failed delivery releases its id from `deliveredAnswers` so it can retry once the page recovers.
- `dismissedSessionsV2` is versioned because v1 poisoned itself: it dismissed every watched session without an open tab, so one closed tab blacklisted everything forever; old lists are discarded, not migrated. Only the session whose tab actually closed is dismissed (`tabs.onRemoved` + the `openedTabs` map), capped at the last 50.
- Every early return in `openWatchedTabs` records a reason via `note()` → `storage.lastOpen`; silent returns had made "tabs are not opening" unanswerable without a service-worker console.
- Tab identity matches on the session id in the URL, not the whole URL — claude.ai rewrites the query (`?from=cli&m=0`) after load.
- `closeStaleTabs` drops the `openedTabs` record BEFORE closing, so the close is not read as the user dismissing the session; it only ever closes tabs this extension opened.

## Facts

- `DEFAULT_DAEMON = http://localhost:4200`; auth is `Bearer <token>`; storage keys: `daemonUrl`, `token`, `autoOpen`, `dismissedSessionsV2`, `openedTabs` (tabId → sessionId), `lastOpen`.
- Daemon routes used: `/_bridge/hello`, `/_bridge/question`, `/_bridge/events`, `/_bridge/answer`, `/_bridge/answered`, `/_bridge/sessions`.
- Session tabs are found via `chrome.tabs.query({ url: 'https://claude.ai/code/*' })` and the `session_[A-Za-z0-9]+` URL pattern.

## Flows

- question: content `tf-question` → `report()` dedupe → POST `/_bridge/question` → `deliverAnswers([session])` on the same beat.
- answers: alarm `tf-answers` → `pollAnswers` → retry `pendingAcks` → GET sessions → per session GET answer → find tab → `tf-deliver-answer` (reload + retry if our tab is deaf) → `ack()`.
- tab sweep: alarm `tf-sessions` (or `tf-open-now`) → `openWatchedTabs` → GET sessions → `tabs.create` pinned+inactive per new session → `closeStaleTabs` → `note(outcome)`.
- dismissal: `tabs.onRemoved` → look up session in `openedTabs` → append to `dismissedSessionsV2`.
