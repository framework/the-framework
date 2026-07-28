The run view's affordances for a Claude web target (#610): the hand-off notice, the bridge-reported parked question with dashboard answering (#1237), and the log-tail cloud mirror (#1265).

## TLDR

- A web target is a hand-off, not a streamed run: the session runs on Anthropic's infrastructure, makes its own worktree and PR, and there is no read-back API — so `CloudRunNotice` shows where the work went (session URL from `cloudSession(events)`, a copyable `claude --teleport <id>` command) instead of an empty feed that looks stalled.
- Both exported components render `null` for any non-`web` target (and `CloudMirrorRow` also before the hand-off names a session), so the run view/feed mount them unconditionally.
- `ParkedQuestion` (#1237): once the browser bridge reports a `BridgeQuestion`, options render as pick-then-confirm buttons; `sendBridgeAnswer(sessionId, label)` queues the answer for the extension to type into the user's own claude.ai tab; a failed delivery re-offers the question with the failure note.
- `AnswerState`: `queued` = the extension has not collected it yet (still cancellable via `sendBridgeAnswerCancel`); `sent` = typed and submitted. The question card yields to it so a second pick cannot race the first.
- `CloudMirrorRow` (#1265): one clearly-labelled box pinned at the log tail rendering the bridge's scraped transcript (`onBridgeEvents`), with a connecting spinner so a web run never shows dead air.
- `scrubMirrorText` drops claude.ai UI chrome lines (`MIRROR_CHROME`: tile-focus hints, "Show message actions", bare model names) and collapses the holes; anchored per line so a message merely mentioning a model is untouched.

## Problems

- The bridge writes over HTTP from a browser extension and never touches the run's event log, so there is no event for the live channel to carry — question/answer/transcript are all polled (`POLL_MS` = 4s) via `onBridgeQuestion`/`onBridgeAnswer`/`onBridgeEvents`.
- Provenance separation: `events.jsonl` is durable provenance-clean data; the mirror is a best-effort tab scrape (no tool calls, no timings, nothing when the tab is closed). One visible labelled boundary keeps the two from being confused.

## Decisions

- Answering is a two-step pick-then-send, unlike a local run's one-click gates: the send types into the user's own claude.ai session, so the pick is confirmed explicitly and can be withdrawn while queued; the link out stays as the manual path.
- Poll errors are swallowed: a daemon with the bridge off answers null, and a transport failure is not worth a banner.

## Flows

- notice: `cloudSession(events)` → session URL + teleport command, or "Starting…" before the hand-off lands.
- answer: poll `onBridgeQuestion` → pick option → `sendBridgeAnswer` → poll `onBridgeAnswer` shows queued (cancellable) → sent, or failed → question re-offered.
- mirror: poll `onBridgeEvents` → `scrubMirrorText` per block → labelled box at the log tail (as `EventList`'s `tail`).
