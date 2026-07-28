In-memory store for the browser bridge (#1237): the questions cloud sessions are parked on, their scraped transcripts, and the answer round-trip (queued in the dashboard → delivered by the extension → resolved), plus contact/hello diagnostics.

## TLDR

- `BridgeQuestions` keeps per-session: the parked `BridgeQuestion`, transcript events keyed by `seq` (capped at 300, oldest dropped), the current `BridgeAnswer` (`queued`→`sent`/`failed`), and the fingerprint of the last answered question.
- `queueAnswer` refuses any label that is not one of the parked question's own options — the only text this can ever put in a composer is one the session itself offered.
- `resolveAnswer` (the extension's delivery ack) matches on answer id, so a stale ack from a tab that died mid-delivery cannot resolve a newer answer; on success the question is dropped and its fingerprint remembered.
- Module singleton via `bridgeQuestions()` (+ `resetBridgeQuestions()` for tests).

## Problems

- The extension's worker forgets what it delivered when it restarts, and the answered block stays in the page's DOM, so an answered question would resurface as parked — solved by fingerprinting (title+options+recommended, not receivedAt) and dropping re-reports of an already-answered question.
- Transcript entries arrive repeatedly (re-scrape on every DOM change) and messages mid-stream change; keying by `seq` dedupes and lets a later read replace an earlier one.

## Decisions

- In memory on purpose: a question is only answerable while the session is parked, the bridge re-reports on reconnect, and surviving a daemon restart would preserve a question possibly already answered elsewhere.
- A genuinely *new* question (different fingerprint) wipes the session's queued/answered answer state: an undelivered pick for the old question must not be typed into the new one.
- Failed contacts are recorded too: a misconfigured extension looks exactly like an uninstalled one (both leave no question); a refused request at least proves something is trying.
- A module singleton rather than a `DashboardContext` field because the two ends reach it by different routes: the raw HTTP bridge handler writes, a telefunction reads, and a telefunction cannot be handed anything the request did not carry.
