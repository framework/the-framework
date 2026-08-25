# Bug analysis: packages/framework/src/dashboard/bridge-store.ts

## Business logic (high-level)

The in-memory store behind the Claude web bridge (#1237/#1554): per cloud session, the question it is parked on, the answer the user picked, the transcript so far, plus bridge diagnostics (last contact, last version claim, page-script hello). Everything is deliberately non-persistent (SPEC: a restart must not resurrect a question that may already be answered elsewhere; the extension re-reports on reconnect).

Key invariants and how the code holds them:

- **One parked question per session; identity by fingerprint** — `record` replaces by `sessionId`; `fingerprint` is `JSON.stringify([title, options, recommended ?? null, multi ?? false])`. Stability of the fingerprint depends on options having a deterministic key order — they do, because the only producer is `bridge-endpoints.ts`'s `validate`, which rebuilds each option literal in a fixed shape and enforces distinct labels. Reliance noted (a second producer with pass-through objects would silently break re-report detection).
- **An answered question does not resurface** — `resolveAnswer(ok)` remembers the fingerprint in `answeredBySession`; `record` drops a matching re-report. Only one fingerprint is remembered per session, which is sufficient because the extension reports the page's latest block only.
- **A new question discards the old answer** — `record` with a different fingerprint deletes both the queued/settled answer and the answered memory. A pick fetched by the extension but not yet delivered when the session moves on cannot be un-fetched — that residual distributed race is outside what a store can close, and the SPEC does not claim otherwise.
- **Only offered labels can be queued; the composed text is a local gate's wording** — `queueAnswer` filters the parked question's options by the picked labels, refuses unknowns/duplicates/wrong cardinality, and composes via `continuationPrompt`/`takeoverPrompt` (turn-gate.ts), `(none)` for an empty multi-pick. This is the whole injection bound: no user text ever reaches a composer.
- **Delivery reports are matched by answer identity** — `resolveAnswer` requires the stored answer's `id` and `queued` state, so a stale ack cannot settle a newer pick.
- **Presence** — `extensionAlive` is "last contact was let in (`status < 400`) within 3 minutes". Only the latest contact is kept, so one refused request right after a good poll flips presence off for up to one poll interval (≤30s); consistent with the SPEC's "a refusal does not count", transient, accepted.
- **Transcript bounded by position** — `recordEvent` keys by `seq`, keeps the newest `MAX_SESSION_EVENTS` (300) by dropping the lowest seqs; `events` returns seq-ascending.

Concurrency: all methods are synchronous over `Map`s; the HTTP handler and RPCs run on one event loop, so no intra-store races exist.

## Functions (low-level)

- `recordContact` / `lastContact` — overwrite/read one record, refusals included (that is the diagnostic point). Correct.
- `recordVersion` / `version` — last claim incl. accepted ones (clears a blocked banner). Correct.
- `recordHello` / `hello` — last page-script report. Correct.
- `extensionAlive(now, windowMs)` — false when no contact or last contact refused; else age ≤ window. `Date.parse` of its own `toISOString` is exact. Correct.
- `recordEvent` — creates the per-session map, sets by seq, prunes oldest beyond 300 (sorts keys numerically, deletes the excess head). Off-by-one checked: with 301 entries it deletes exactly 1. Correct.
- `events` — sorted copy; empty array for unknown session. Correct.
- `record` — answered-fingerprint drop first, then old-answer/answered purge on fingerprint change, then set. Re-reports refresh `receivedAt` (validate stamps arrival), so `list()`'s newest-first order is by latest report — matches "newest first". Correct.
- `queueAnswer` — refusal strings for: no parked question; unknown label or duplicate (`picked.length !== labels.length || Set size mismatch`); non-multi cardinality ≠ 1. Duplicate labels *among options* cannot occur (validate enforces distinct labels), otherwise a legitimate single pick of a duplicated label would be refused — reliance noted. Joined text uses option order (labels joined in the order the question listed them), `(none)` for empty multi, takeover wording when any picked option is `stop`. Replacing an already-queued answer is allowed (pinned by the stale-ack test) — the earlier pick may already be in the extension's hands; inherent race, accepted. Correct.
- `cancelAnswer` — only a `queued` answer; deletes it. A `failed` answer is not cancellable (it is a record, and retrying replaces it). Correct.
- `pendingAnswer` / `answer` — queued-only view for the extension vs any-state view for the dashboard. Correct.
- `resolveAnswer` — id + queued guard; marks sent/failed with optional note; on success remembers the parked question's fingerprint and drops the question. If the question changed between queue and ack, the answer was already purged by `record`, so the guard drops the stale ack — consistent. Correct.
- `get` / `list` / `clear` — lookup, newest-first list, and full per-session teardown (question, events, answer, answered memory — all four maps). Correct.
- `fingerprint` — see business logic; `recommended ?? null` and `multi ?? false` normalize absent fields so absent and explicitly-false compare equal. Correct.
- `bridgeQuestions` / `resetBridgeQuestions` — module singleton (raw HTTP writer and RPC reader meet in one store) + test reset. Correct.

## Bugs found

None found.
