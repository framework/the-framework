# Bug analysis: packages/framework/dashboard/components/EventList.tsx

## Business logic (high-level)

Presentational transcript of a `FrameworkEvent[]`, shared by the live stream and past-run replay.
Responsibilities per SPEC (`EventList.SPEC.md`):

- One human-readable row per event (terminal formatter text), with a once-per-group kind badge and
  a once-per-group arrival time (live only — replayed events carry no stamp, `receivedAt` WeakMap).
- Conversation rows (`driver start` / `driver text`) render their raw text as Markdown; long ones
  clamp to the first line and expand in place.
- The first prompt is hoisted to the top (`promptFirst`); later prompts stay put.
- Colour semantics: failures red (`isFailure`: driver error, agent-reported `error`, bad non-stopped
  `end`), user's turn blue; badge tints (choice amber, clean end / ready-for-merge green, pushed
  surfaces primary); background wash on exactly user turns / failures / clean end.
- With `projectId`: a gate row IS the interaction (`foldChoiceRows`) — open gate → inline
  ChoicePanel, resolved gate → AnsweredChoice card + its `choice-resolved` line hidden; gate closed
  by `end` unanswered stays text; only the LAST firing of an id is special.
- With `projectId` + `agentId`: the latest `browser` row hosts InlineBrowser (`foldBrowserRows`);
  re-said URL replaces its earlier row (hidden set); `live` false once an `end` follows.
- Scrolling via message-scroller: `autoScroll` when `stick`, replay opens at `openAt ?? 'start'`,
  `tail` pinned inside the scroller.

Invariants checked:

- Fold maps key rows by event object identity, and `promptFirst` only reorders the same objects, so
  reordering does not break `rows.get(e)` / `hidden.has(e)` lookups. Correct.
- The browser `pane` can never be in `hidden` (a later same-URL event both hides the prior and
  becomes the pane). Correct.
- `live` re-arms on a `browser` event after `end` (resumed session re-announces its URL). Correct.
- `foldChoiceRows` "resolution before the firing" guard (`resolved.at > firing.at`) prevents a
  re-fired-then-`end`-closed gate from wearing an earlier pick. Correct, matches #1359 note.

Concurrency/ordering concerns:

- Rows are keyed by array index (`key={i}`, `messageId={String(i)}`). Hidden rows and prompt
  hoisting shift indices under live appends — see Bugs.
- `newestOpen` is derived from `lastFiring`'s Map iteration order, which is *first*-insertion order
  per id (a re-fired id keeps its original position). See Bugs (low confidence).

## Functions (low-level)

- `disclosableText(e)`: only `system-prompt` → char-count summary + full text behind `<details>`.
  Correct.
- `messageText(e)`: `driver start` → prompt, `driver text` → text, else null. Correct.
- `isLong(text)`: collapse whitespace, trim, `> 100`. Mirrors terminal truncation threshold.
  Correct.
- `rowGroup` / `rowLabel`: `driver start` breaks into its own `you` group/badge; everything else
  groups by kind with `eventKindLabel`. Correct.
- `isTurnBoundary`: `driver start`. Used both for hoisting and scroll anchors. Correct.
- `isFailure`: driver `error`, `kind === 'error'`, or `end && !ok && !stopped`. Matches SPEC ("a
  stopped run is neither"). Correct.
- `rowTone` / `badgeTone` / `rowWash`: semantics first (failure red, own turn blue), then per-kind
  badge tints, wash on the three hunted rows. `badgeTone` includes `browser` in the primary list —
  the doc comment omits it but the test pins it, so comment-only drift. Correct.
- `promptFirst(events)`: hoists the first `driver start` above what preceded it; `at <= 0` returns
  as-is (already first / absent). Correct.
- `formatTime(ms)`: locale HH:MM:SS. Correct.
- `foldChoiceRows(events)`: builds `lastFiring` / `lastResolved` per id, `open` from
  `pendingChoices` (which honours `end` clearing all gates), renders last firing as open panel or
  answered card, hides the consumed `choice-resolved` line. Earlier firings and superseded
  resolutions keep their text. Verdict: correct except the `newestOpen` ordering nit (Bugs #2).
- `foldBrowserRows(events)`: last `browser` event is the pane; same-URL priors hidden; `live`
  toggled by `end`. Correct.
- `Message({text})`: short → plain compact Markdown; long → chevron + clamped div, click either to
  expand, collapse only via chevron (`onClick` removed when open so text can be selected — SPEC only
  requires expand-on-line-click). Correct.
- `EventList(props)`: memoises folds on `[projectId, (agentId,) events]`; `shown` filters hidden
  rows after hoisting; render picks disclosable → message → choice row → browser pane → formatter
  text; `chunkHead` from the previous *shown* row; time cell only at `chunkHead` when stamped.
  ChoicePanel gets `key={choice.id}` (state survives re-fires) but the row wrapper itself is
  `key={i}` (see Bugs #1). Verdict: bug found (minor).

## Bugs found

1. `L314` (also `messageId` on the same line): rows are keyed by their index in `shown`, but
   `shown`'s indices shift under live updates — a re-said browser URL hides an *earlier* row
   (`foldBrowserRows`), and the first `driver start`'s arrival reorders everything (`promptFirst`).
   Scenario: the user expands a long agent reply mid-run; the agent later re-announces a URL it
   already showed (a continuation re-says its URL after every `session`), hiding the older browser
   row above the expanded message; every later row shifts down one key, so the expanded message
   collapses (its `useState(open)` now belongs to the previous row) and a different row may appear
   expanded, and `scrollAnchor`/`messageId` bookkeeping in the scroller likewise points at the
   wrong rows. Contradicts intent: stale/wrong UI state; the SPEC's "expands in place" implies the
   expansion stays with its message. Severity: minor. Fix sketch: key rows by a stable identity —
   e.g. the event's original index in `events` (compute `events.indexOf`-free by mapping before
   filtering: `promptFirst(events).map((e) => ({e, id: originalIndex}))`) — and pass that as both
   `key` and `messageId`.

2. `L190`: `newestOpen` takes the last *map-order* entry of `lastFiring`, and Map order is
   first-insertion order per id — a re-fired gate keeps its original position. Scenario: gates A
   and B are both open (A fired, then B, then A re-fired last); the bottom-most, most recently
   fired open row is A's re-fire, but `active` (the Ctrl+Enter binding) goes to B. Contradicts the
   SPEC's "only the newest open gate is the active one" under the natural reading of "newest" =
   most recently fired. Severity: minor (needs ≥2 simultaneously open gates plus a re-fire; the
   in-place-replacement convention of `pendingChoices` makes the intended order genuinely
   ambiguous). Confidence low. Fix sketch: track the firing index and pick the open firing with the
   greatest `at` (`if (open.has(id) && (!best || firing.at > best.at)) best = firing`).

None of the other suspicions survived: fold lookups are identity-based so `promptFirst` cannot
detach them; the pane row cannot be hidden; `live` correctly re-arms after a resumed session.
