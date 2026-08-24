# Bug analysis: packages/chrome-extension/content.js

## Business logic (high-level)

The page half of the bridge, injected into every `https://claude.ai/*` page and frame. It:

- extracts the parked question (a JSON object carrying `options`) from code elements — shadow
  roots included — falling back to whole-page text, discards the protocol's own decoys (anything
  in the opening turn, placeholder titles/labels, the two literal examples), takes the last
  survivor in page order, and reports it to the worker keyed by the session id from the URL;
- mirrors the transcript one `transcript-row` at a time under the page's own `data-index`,
  re-sending only turns whose text changed and remembering only what the daemon accepted;
- on `tf-deliver-answer` (top frame only) waits up to 20s for a composer, fills it, waits 400ms,
  submits via the last enabled send button or synthetic Enter, and reports which path it used;
- on `tf-create-session` drives the new-session page: repo chip/picker, branch chip (verified to
  read the requested branch before anything is sent), prompt, send, then reads the session id from
  the URL;
- draws a diagnostic panel (top frame) with fold state kept in extension storage; child frames post
  their surveys to the top frame instead;
- re-surveys on DOM mutations (debounced 250ms) plus a 60s heartbeat, and shuts down when its
  extension context dies.

Invariants: no token or daemon fetch here (holds — everything goes through
`chrome.runtime.sendMessage`); only the top frame delivers/creates (holds — listener gated on
`IS_TOP`); the typed text comes only from the daemon (holds — `deliverAnswer` types
`message.text` verbatim; but see Bug 1: it can end up *appended to* pre-existing user text, so
what is submitted is not only the daemon's text); reports are trimmed "to what the daemon
accepts" (mostly holds — title/detail/option-count yes, option labels and `recommended` no,
Bug 3; event batches no, Bug 2).

Concurrency/ordering: the mutation observer, the 60s heartbeat, and the panel's re-renders all
funnel through `survey()` → `findPendingChoice()` → `reportToDaemon()`/`reportTranscript()`;
duplicates are cheap because the worker and daemon both dedupe. `sentEvents` is keyed by `seq`
only, not by session — an SPA navigation to a different session in the same tab reuses the map,
but a colliding (same seq, same text) turn across sessions is not realistic, and the daemon keys
by session anyway; noted, not a bug. The `message` listener for child-frame surveys accepts any
origin and posts with `'*'` — a hostile iframe inside claude.ai could spoof the panel display and
a hostile embedder could read a child frame's survey, but claude.ai does not host third-party
frames and is not embeddable in practice, the data never reaches the daemon (child frame URLs
carry no session id), and rendering uses `textContent` (no XSS); noted, not reported.

## Functions (low-level)

- **`sessionIdFromUrl()` (L24-27)** — regex over `location.href`; child frames naturally yield
  nothing, which is what keeps them read-only reporters. Correct.
- **`reportToDaemon(parsed)` (L39-84)** — builds the wire shape: title sliced to 500, options
  mapped (string or object), detail sliced to 500, `default`/`stop` only when `=== true`,
  label-less options dropped, capped at 20; drops the whole report when no title/options. Gaps:
  option `label` is *not* sliced to the daemon's 300-char `MAX_LABEL` and `recommended` is not
  sliced/validated against the sent labels, so an out-of-bounds label or a `recommended` that
  names a dropped/26th option makes the daemon 400 the entire question forever (Bug 3). Records
  the worker's verdict in `bridgeStatus` for the panel. Verdict: **bug found** (minor).
- **`transcript()` / `turnRows()` / `openingMessage()` (L105-129)** — rows by
  `data-testid="transcript-row"`, role map human/assistant, integer non-negative `seq`, text
  cleaned and sliced to 8000 (matches daemon `MAX_EVENT_TEXT`). `seq > 10_000` would be rejected
  daemon-side but a 10k-turn session is not a real input. Correct.
- **`cleanText(text)` (L135-143)** — strips private-use glyphs, trims lines, drops blanks. Correct.
- **`sayHello(sessionId, note)` (L152-160)** — best-effort self-report; reads `lastError` to keep
  Chrome quiet. Correct.
- **`reportTranscript()` (L167-206)** — sends only changed turns; remembers only on daemon accept,
  so refused batches retry. Flaw: the changed set is sent as **one** batch with no chunking while
  the daemon rejects batches over `MAX_EVENT_BATCH = 50` entries — a first pass over a page with
  more than 50 rendered turn rows would 400 forever, since nothing is remembered and the batch
  never shrinks (Bug 2). `sayHello` reports the *previous* pass's `transcriptStatus`, which is
  what the SPEC says ("the outcome of the last transcript report"). Verdict: **bug found**
  (low confidence on reachability).
- **`deepQueryAll` / `countShadowRoots` / `deepText` (L209-237)** — recursive shadow traversal
  with a `seen` set; `deepText` may double-count slotted text across nested roots, which only
  inflates diagnostics counters. Ordering caveat: shadow-root matches are appended after their
  host root's light-DOM matches, so "last in page order" is approximate across mixed light/shadow
  transcripts; on the real page all messages render in one container, so the tiebreak holds.
  Correct.
- **`isTemplate(parsed)` (L252-266)** — placeholder title, punctuation-joined placeholders (letters
  check is Unicode-aware), all-placeholder labels, and the two literal examples. The literal
  match uses labels joined with `|`; a label containing `|` could in principle collide, but the
  literal sets are fixed strings. Correct.
- **`inFirstMessage(el, first)` (L275-282)** — walks `parentNode ?? host` so shadowed highlighters
  resolve to their turn row. Correct.
- **`extractChoices` / `collectChoices` (L285-350)** — brace matcher tracking strings and escapes;
  on a parse success skips past the object (`i = j`), on failure rescans from the next `{` so
  nested candidates are still found; stats separate "never found" from "found, unparseable".
  Quadratic worst case on pathological text — performance, not correctness. Correct.
- **`findPendingChoice()` (L357-386)** — element-scoped scan excluding the opening turn, page-text
  fallback with by-value subtraction of prompt blocks, template filter, last survivor wins, then
  reports question and transcript. The by-value subtraction can drop a real question identical to
  a prompt block — the SPEC accepts this cost explicitly. Correct.
- **`findComposer()` (L389-395)** — first contenteditable, else first textarea. Correct.
- **`fillComposer(composer, text)` (L401-421)** — textarea path *replaces* (`value = text`);
  contenteditable path focuses and `execCommand('insertText')`, which *inserts at the selection*
  without clearing existing content, falling back to `textContent = text` (which does replace).
  So the two supported paths disagree about pre-existing content, and the primary live path
  (execCommand on claude.ai's rich editor) appends to any draft already in the composer (Bug 1).
  Verdict: **bug found**.
- **`findSendButton()` (L424-430)** — last enabled `aria-label*=send` button, else last
  `button[type=submit]` (that fallback skips the disabled check; acceptable guesswork the SPEC
  endorses). Correct.
- **`deliverAnswer(text)` (L440-470)** — waits up to 20s for a composer, fills, 400ms settle,
  button else synthetic Enter; honest failure when no composer. It reports `ok: true` without
  verifying the message actually posted — if a rich editor ignored both fill paths the send
  button stays disabled, the Enter fallback fires into an empty composer, and the daemon marks
  the question resolved though nothing was typed. The SPEC only requires reporting *which path
  was used*, and the live page accepts `execCommand`, so: suspicious-but-unproven, not filed.
- **`controlText` / `usable` / `menuTriggers` / `chips` / `menuEntries` / `pickerSearch` /
  `typeInto` / `waitFor` (L487-555)** — visibility-aware control discovery; `checkVisibility`
  absent (jsdom) counts as visible by design; `typeInto` uses the native value setter for React.
  Correct.
- **`chooseFrom(trigger, wanted, hint)` (L566-600)** — opens, waits for entries, exact-match on
  lower-cased glyph-stripped text, search-box filter with clear-and-rescan fallback, Escape and a
  rich diagnostic on failure; never clicks the trigger or its descendants as an entry. Correct.
- **`probeNewSession()` (L607-619)** — read-only description, capped. Correct.
- **`createSession({repo, branch, prompt})` (L632-691)** — the three remembered-repo states, late-
  render re-read, chip verification after picking, branch verified to read the requested ref
  before anything is sent (a mistaken chip — e.g. `chips()[1]` catching the "add repository" chip
  before the branch chip renders — fails safe through `readsBranch`), send, session id from URL
  with 60s wait. Failure notes name the missing control. Correct.
- **runtime `onMessage` listener (L695-713)** — top frame only; probe answered synchronously;
  create/deliver async with catch-to-failure. Correct.
- **offline exports (L718-722)** — only when `chrome` is undefined; nothing leaks onto the real
  page. Correct.
- **`diagnostics()` / `survey()` (L728-782)** — structure-only counters, no message text; matches
  the SPEC's paste-into-an-issue promise. Correct.
- **child-frame sender / top-frame panel (L786-939)** — child frames post surveys up (only when
  they saw something), top frame renders panel rows with `textContent`, fold state in extension
  storage restored asynchronously, "Fill composer (does not send)" fills without submitting (same
  append caveat as Bug 1, but the button is explicitly a non-sending probe, so harmless).
  Correct.
- **`watch(run)` (L949-977)** — 250ms-debounced MutationObserver plus 60s heartbeat; `alive()`
  disconnects both when the extension context dies, wrapped against `chrome.runtime` itself
  throwing. Correct.

## Bugs found

1. `L407-L419`: **A delivered answer is appended to whatever the user already typed, and the
   combined text is submitted.** The contenteditable fill path focuses the editor and uses
   `document.execCommand('insertText')`, which inserts at the current selection without clearing
   existing content (the textarea path, by contrast, replaces via `value = text`). Scenario: the
   user starts typing a message to the cloud session in its (watched or self-opened) tab, walks
   away, then answers the parked question from the dashboard; `deliverAnswer` inserts the
   daemon-composed text into the draft and submits draft+answer as one message. That contradicts
   the SPEC's core promise that "the extension never speaks for me beyond the option I picked" /
   "what is typed … is built from what the session offered, never free text from the browser".
   Severity: minor (needs a pre-existing draft, but that is exactly the state the worker's
   never-reload-user-tabs rule anticipates). Fix: clear or select the editor's content before
   inserting — e.g. `execCommand('selectAll')` (or a Range over `composer.el`) ahead of
   `insertText`, mirroring the replace semantics of the textarea path.

2. `L184-L202`: **A changed-turn set larger than 50 is sent as one batch, which the daemon
   rejects forever.** `reportTranscript` sends every changed turn in a single `tf-events` message
   and the worker forwards it as one `POST /_bridge/events`; the daemon rejects any batch over
   `MAX_EVENT_BATCH = 50` (bridge-endpoints.ts L309) and rejects it wholesale. Because nothing is
   remembered on rejection, the identical oversized batch is re-sent on every mutation and the
   session's transcript never mirrors at all — the panel shows the 400 but the failure is
   permanent. Trigger: a session page whose virtualized feed renders more than 50 turn rows on
   first survey (long transcript in a tall window). Severity: minor. Confidence: low (whether
   claude.ai ever renders >50 rows at once is unverified). Fix: chunk `events` into slices of at
   most 50 before sending (or have the worker split them).

3. `L53`/`L61`: **Option labels and `recommended` are not trimmed to what the daemon accepts, so
   one oversized or dangling field kills the whole question.** The daemon requires each label
   ≤300 chars and `recommended` to match a *sent* label; `reportToDaemon` slices title (500) and
   detail (500) but sends labels and `recommended` untrimmed, and the 20-option cap can drop the
   very option `recommended` names. Scenario: an agent emits a question whose recommended label is
   over 300 characters (or sits past the 20th option) — `POST /_bridge/question` answers 400 and,
   since failures are never remembered, every DOM change retries the same rejected payload; the
   question never reaches the dashboard, contradicting this file's SPEC ("It is trimmed to what
   the daemon accepts before being sent"). Severity: minor. Confidence: low (agent-authored labels
   are normally short). Fix: slice labels to 300 in the option mapping, and drop `recommended`
   when it does not match one of the labels that survived trimming.
