# Bug analysis: packages/chrome-extension/background.js

## Business logic (high-level)

The extension's service worker: the only half that holds the bridge token and talks to the daemon.
Responsibilities per `background.SPEC.md`:

- Relay content-script messages to the daemon (`tf-question` → `POST /_bridge/question`,
  `tf-events` → `POST /_bridge/events`, `tf-hello` → `POST /_bridge/hello`), deduplicating
  repeated questions per session in memory (`lastSent`).
- Poll `GET /_bridge/answer` per watched session (alarm every 30s + immediately after a question is
  accepted), hand the text to the session's tab, and ack via `POST /_bridge/answered` — typing
  strictly before acking, with `deliveredAnswers` as the in-worker claim set so an answer is never
  handed to a tab twice "for as long as the service worker lives" (SPEC). Failed acks are retried
  from `pendingAcks` at the start of every poll; a 400 settles an ack.
- Claim `GET /_bridge/start`, open the new-session page in a pinned inactive tab, have the content
  script drive it, report `POST /_bridge/started`. SPEC: "Sessions are created one at a time …
  a second request waits for the first to finish", guarded by the `creating` flag.
- Sweep `GET /_bridge/sessions` once a minute (+ on worker start + on demand from the options
  page): open one pinned, inactive tab per watched session, skip dismissed sessions, close tabs it
  opened for sessions no longer watched, and record every outcome under `lastOpen`.
- Bookkeeping in `chrome.storage.local`: `openedTabs` (tabId → sessionId for tabs *we* opened),
  `dismissedSessionsV2` (sessions whose tab the user closed; capped at 50), `lastOpen`.

Invariants the SPEC states and the code must uphold:
1. token never enters a page — holds: token only read here and in options.
2. version lockstep — holds: `VERSION_HEADER` on every fetch.
3. type-then-ack ordering — holds within one call path.
4. an answer already handed to a tab is not handed again while the worker lives — **violated by a
   TOCTOU race, see Bugs 1**.
5. one creation at a time — **violated by a race on `creating`, see Bug 3**.
6. a user-closed tab dismisses exactly that session; extension-closed tabs never dismiss — holds
   in the single-event case (`closeStaleTabs` drops the record before removing), **but concurrent
   close events lose dismissals, see Bug 4**.

Concurrency model — the central weakness. An MV3 worker woken by an alarm first evaluates the
whole script (running the top-level `void openWatchedTabs(); void pollAnswers(); void pollStarts()`
at L445-447) and then dispatches the alarm event (running the same functions again from the
listener at L437-444). So on every wake from idle, `openWatchedTabs`, `pollAnswers` and
`pollStarts` each run twice, near-simultaneously. None of these functions is re-entrant: their
guards (`deliveredAnswers`, `creating`) are checked before `await` points and set after, and all
storage bookkeeping is non-atomic read-modify-write of whole objects. Since Chrome idle-terminates
the worker after ~30s and the fastest alarm fires every 30s, wake-by-alarm (and hence the double
run) is a routine occurrence, not an edge case. The daemon side compounds this: `bridge-store.ts`
`pendingAnswer()` keeps returning the same queued answer until it is *acked* (collection does not
consume it), and `handleStart` *does* consume a start request per GET — so concurrent answer polls
both receive the same answer, and concurrent start polls claim two different requests.

The deliberate design trade the SPEC accepts — an answer typed but unacked before worker death is
typed a second time later — is out of scope (documented cost). Everything the claim set is
supposed to prevent *within* one worker life is in scope.

## Functions (low-level)

- **`onMessage` listener (L22-48)** — routes `tf-open-now`, `tf-hello`, `tf-events`,
  `tf-question`; returns `true` to keep the channel open; every promise chain has a `.catch` that
  still calls `sendResponse`. Correct.
- **`report(question)` (L50-75)** — validates sessionId, requires token, dedupes on
  `JSON.stringify([title, options, recommended])` per session, posts, remembers only successes,
  then probes for an answer on the same beat. Edge cases: fingerprint omits `multi`/option flags —
  irrelevant in practice since a changed question changes title/options; `lastSent` is in-memory so
  a daemon restart is healed as soon as the worker idles out (~30s) and forgets. Correct.
- **`deliverAnswers(sessionIds)` (L99-146)** — per session: fetch answer, validate, find the tab by
  session id in the URL, claim in `deliveredAnswers`, sendMessage, reload-and-retry only for tabs
  we opened, release the claim on failure, ack. The claim check (L114) happens *before* the
  `chrome.tabs.query` await (L116) while the claim insert (L121) happens after it — a re-entrancy
  hole (Bug 1). The reload path waits a fixed 5s; a claude.ai page routinely takes longer to
  re-inject, but the failure is acked, the claim released, and the next 30s poll retries — self-
  healing, fine. `outcome` undefined → synthesized failure. Verdict: **bug found** (race).
- **`ack(base, token, body)` (L150-165)** — ok/400 settles, anything else (or throw) queues in
  `pendingAcks` keyed by answer id. 401/426 acks retry forever but the set is tiny; bounded.
  Correct.
- **`pollAnswers()` (L168-183)** — replays pending acks, lists sessions, delivers. Not re-entrant
  but all the harm funnels into `deliverAnswers` (Bug 1). Correct in isolation.
- **`tabLoaded(tabId)` (L200-212)** — resolves on `status === 'complete'` or after 30s; listener
  removed on either path; double `done()` harmless. Correct.
- **`askPage(tabId, start)` (L215-227)** — 10 tries × 2s; returns first truthy outcome; synthesizes
  a failure note from the last error. Correct.
- **`pollStarts()` (L229-277)** — `creating` guard checked at entry (L230) but set only at L244,
  after two awaits (storage get, claim fetch). Two overlapping invocations both pass the guard and
  both *claim* a start from the daemon (the daemon dequeues per GET — bridge-endpoints.ts
  `handleStart`), then drive two creations concurrently (Bug 3). Also: the function is not
  try/finally around `creating = false`; an exception from `chrome.storage.local.set` (L258) or
  `note()` (L275) would wedge `creating` at true — but only until the worker is idle-terminated,
  so not reported. Field validation of `start`, tab cleanup on failure, and the report body are
  correct. Verdict: **bug found** (race).
- **`post(path, body)` / `postEvents(msg)` (L280-305)** — straightforward authenticated POSTs with
  error text capped at 200 chars. `postEvents` forwards `sessionId`/`events` unchanged (the daemon
  re-validates). Correct.
- **`dismissed()` / `openedTabs()` (L325-334)** — storage reads with defaults. Correct.
- **`note(state)` (L342-345)** — records `lastOpen` with a timestamp. Shared by the tab sweep and
  `pollStarts` (a creation outcome overwrites the last sweep outcome), but the options page only
  reports fresh on-demand sweeps, so no user-visible harm. Correct.
- **`openWatchedTabs()` (L347-394)** — token/opt-out gates, session listing with reasons, dedupe
  against open tabs by session id, dismissed skip, create pinned+inactive, record `openedTabs`,
  close stale, record outcome. Three problems: (a) not re-entrant — two concurrent sweeps compute
  `already` from the same pre-create `tabs.query` snapshot and both open a tab for the same
  session (Bug 2); (b) `openedTabs` update is a read-modify-write of the whole object racing other
  writers (folds into Bugs 2/4); (c) the comment at L350 calls the switch "opt-in" while
  `autoOpen === false` makes it default-on — the SPECs disagree with each other on this (see
  options.js analysis; the doc bug is filed there). A `tabs.create` failure aborts the loop before
  `closeStaleTabs`, but it is reported, and the next sweep retries — acceptable. Verdict: **bug
  found** (re-entrancy).
- **`closeStaleTabs(watched)` (L402-412)** — drops records first so the remove is not mistaken for
  a user dismissal, then removes with errors swallowed. Ordering is right. Correct.
- **`tabs.onRemoved` listener (L419-429)** — attributes a close to a session, drops the record,
  appends to the dismissed list (capped 50). Non-atomic read-modify-write: two closes at once
  (window close with several pinned tabs) each read the same snapshot and the last write wins,
  losing one dismissal and resurrecting the other tab's `openedTabs` entry (Bug 4). Verdict:
  **bug found** (race).
- **Alarms + startup kicks (L433-447)** — alarms are the right instrument; the top-level kicks are
  the "once when the service worker starts" behavior the SPEC asks for, but combined with the
  alarm dispatch on the same wake they are what makes every function above run twice concurrently.

## Bugs found

1. `L114`/`L121`: **The same answer can be typed into the session twice while the worker lives.**
   `deliveredAnswers.has(answer.id)` is checked at L114, but the claim is only inserted at L121,
   after the `await chrome.tabs.query(...)` at L116. Two concurrent `deliverAnswers` runs for the
   same session — which happen routinely: on every alarm wake of an idle-terminated worker the
   top-level `void pollAnswers()` (L446) and the alarm handler's `pollAnswers()` (L440) run
   back-to-back, and `report()` also kicks `deliverAnswers` (L73) while a poll may be in flight —
   both fetch the same still-`queued` answer (the daemon's `pendingAnswer()` does not consume on
   read), both pass the `has` check before either inserts, and both `sendMessage` the text, so the
   content script fills and submits the composer twice. This contradicts the SPEC's explicit
   guarantee ("An answer already handed to a tab is not handed to another one for as long as the
   service worker lives") and the module's own comment (L94-97). Severity: major. Fix: make the
   check-and-claim atomic — insert into `deliveredAnswers` synchronously right after the `has`
   check (before any await) and delete the claim when no tab is found; or serialize
   `deliverAnswers` behind a module-level in-flight promise.

2. `L445`: **Duplicate pinned tabs for a watched session (and lost `openedTabs` records) from the
   sweep double-running on every alarm wake.** When the `tf-sessions` alarm wakes an
   idle-terminated worker, the script's top level runs `void openWatchedTabs()` (L445) and the
   alarm listener runs it again (L438) a few milliseconds later. Both invocations query open tabs
   (L367) before either has created one, so both see the same `already` set and both create a
   pinned tab for every watched session that lacks one — the user gets two pinned tabs per new
   cloud session, and `closeStaleTabs` never removes the duplicate because its session is still
   watched. The interleaved `chrome.storage.local.set({openedTabs: {...(await openedTabs()), …}})`
   writes (L386) also lose one tab's record (last write wins), leaving a tab the extension opened
   unattributed: it is never auto-closed, and the user closing it no longer dismisses the session.
   Severity: major. Fix: make `openWatchedTabs` non-reentrant (return the in-flight promise when
   one exists), which also covers the top-level-plus-message (`tf-open-now`) overlap.

3. `L230`/`L244`: **Two session creations can run concurrently, violating the serial-creation
   contract.** `pollStarts` checks `creating` at entry (L230) but sets it only at L244, after
   `await chrome.storage.local.get` and the claiming `await fetch('/_bridge/start')`. The
   top-level kick (L447) and the alarm handler (L442) run `pollStarts` twice on every wake; both
   pass the guard, and since the daemon dequeues one start request per GET, each claims a
   *different* request when two or more are queued (exactly the fan-out case: several web runs
   started together) and both drive new-session tabs at the same time — contrary to the SPEC
   ("Sessions are created one at a time … a second request waits for the first to finish") and the
   code's own rationale (L188-189). Whichever finishes first also resets `creating` while the
   other is still driving its page. Their concurrent `openedTabs` writes (L258) can additionally
   lose a record as in Bug 2. Severity: minor (each creation drives its own tab, so the damage is
   spec-contract, bookkeeping, and unthrottled parallel tab driving rather than a wrong session).
   Fix: set `creating = true` synchronously right after the entry check (before any await) and
   reset it on every early return.

4. `L419-L429`: **Closing several extension-opened tabs at once loses dismissals, so a
   user-closed session's tab is reopened.** The `onRemoved` handler does a non-atomic
   read-modify-write of both `openedTabs` and `dismissedSessionsV2`. When the user closes a window
   holding two pinned session tabs (or hits "close other tabs"), both handlers read the same
   pre-close snapshot; the second `chrome.storage.local.set` overwrites the first, so one
   session's dismissal is dropped and the other closed tab's `openedTabs` entry is resurrected.
   The next sweep sees the un-dismissed session with no open tab and reopens it — exactly the
   user-hostile behavior the SPEC rules out ("A tab the user closed is not reopened"). Severity:
   minor. Fix: serialize the storage updates (a module-level promise queue shared by every
   `openedTabs`/`dismissedSessionsV2` writer), or key the records individually instead of as one
   object.
