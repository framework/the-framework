# Bug analysis: packages/framework/dashboard/components/CloudAgentNotice.tsx

## Business logic (high-level)

Everything the dashboard shows for a `web` (Claude Code cloud) agent (#610/#1237/#1554/#1265):

- `CloudAgentNotice`: the hand-off banner ("Starting…" before `cloudSession(events)` finds the
  session; then the explanation + `claude --teleport` copy + link), the bridge-reported parked
  question rendered through the shared `ChoicePanel` (`countdown={false}`, bridge `send`), and
  the answer's state (queued with Cancel / sent / failed → question back with the failure named).
- `bridgeSend`: adapts `sendBridgeAnswer` to `ChoicePanel.send`, throwing on `{ ok: false }` so
  the panel's `useAction` shows the daemon's reason.
- `CloudMirrorRow`: the labelled best-effort mirror box at the log tail — scrubbed turns, user
  turns one-line, agent turns whole, auto-scroll-to-newest, connecting placeholder.
- `scrubMirrorText` + `MIRROR_CHROME`: anchored per-line removal of claude.ai UI chrome, holes
  collapsed.
- Three polling hooks (`useBridgeQuestion` / `useBridgeAnswer` / `useBridgeEvents`) on a shared
  4s cadence, each with a `live` flag and interval cleanup; all reset state when `sessionId`
  goes undefined. Rendering nothing for non-`web` targets lets the agent view mount both
  components unconditionally — hooks are called before the early returns, so the hook order is
  stable (correct).

Display precedence checked against the SPEC: question shows when there is no answer or the answer
failed; the queued/sent answer replaces the question ("a second answer cannot race the first");
a failed answer re-offers the question with the failure banner. Matches SPEC and tests.

Ordering/latency concerns:

- The three polls are independent timers, so transiently inconsistent pairs are possible (e.g. a
  new question already polled while the old `sent` answer still shows for ≤4s, because the store
  deletes the answer when a genuinely new question is recorded but the answer poll hasn't run
  yet). Self-correcting within one cadence; not reported as a bug.
- After clicking an option, the question card only yields to the queued-answer state on the next
  `onBridgeAnswer` poll (≤4s). In that window the panel is supposed to be parked by ChoicePanel's
  `sent` state — but that never engages because `bridgeSend` resolves `undefined` on success (see
  ChoicePanel bug: `result !== undefined` is its success test). So for up to ~4s the options
  re-enable and a second pick CAN race the first, which the SPEC explicitly excludes. Fix
  attributed to ChoicePanel L80 (map void success to a defined value) or equally to `bridgeSend`
  returning the `{ ok: true }` result — recorded under ChoicePanel in the report.

## Functions (low-level)

### `CloudAgentNotice({ target, events, projectId, agentId })` (L19–75)

Session derived only for `target === 'web'`; hooks fed `session?.id` (undefined → no polling —
the "never asks before the hand-off lands" test). Early `return null` after hooks. Banner copy,
teleport `<code>` + CopyButton, external link with `rel="noreferrer"`. Verdict: correct.

### `bridgeSend(sessionId)` (L83–88)

Wraps a single pick or array into labels. Throws `Error(result.error ?? …)` on refusal → panel
error. Returns `Promise<void>` — on success resolves `undefined`, which defeats ChoicePanel's
"posted and accepted" detection (cross-file; see above). Verdict: bug (shared with ChoicePanel).

### `ParkedQuestion(...)` (L96–126)

Failure banner (labels joined, optional note), the ChoicePanel, the manual link out. Bug: the
ChoicePanel is mounted with **no `key`**, and `bridgeChoiceRequest` derives a *stable* id
(`bridge:${sessionId}`) for every successive question of the session — but ChoicePanel's own
contract says "mount it with `key={choice.id}` so a re-fired gate resets state", and here even
that would not reset. When the session moves on to a *different* question (the store deletes the
old answer and replaces the question), the already-mounted panel keeps its previous state: a
multi-select's `checked` set stays what the user ticked for the old question (the `useState`
initializer never re-runs, so the new question's `default` options are not pre-ticked and stale
labels may remain checked if they collide), and once the sent-state bug is fixed, a latched
`sent` would park the new question permanently. See Bugs.

### `AnswerState({ answer, url, sessionId })` (L133–164)

Queued → spinner + copy + Cancel (`sendBridgeAnswerCancel` fire-and-forget, error swallowed;
idempotent server-side; UI converges on the next poll). Sent → check + copy + link. Matches SPEC.
Minor: after Cancel the "Sending…" row stays up to 4s (poll cadence) — transient, not reported.

### `MIRROR_CHROME` / `scrubMirrorText(text)` (L172–186)

Anchored per-line regexes (`^…$` on trimmed line): tile-focus hint, "Show message actions", bare
model name with optional "Claude" prefix / version suffix. Filter → join → collapse `\n{3,}` →
trim. Verified against the tests' cases (including 'a\n\nchrome\n\nb' → 'a\n\nb'). A message that
is exactly a bare model name is dropped — accepted by SPEC wording. Verdict: correct.

### `CloudMirrorRow({ target, events })` (L199–242)

Renders nothing for non-web / pre-session. Scrubbed turns filtered when empty; keyed by `seq`
(unique per store contract). User turns: `firstLine` + `title` tooltip; agent turns whole,
`whitespace-pre-wrap break-words`. Placeholder before any turn. Verdict: correct.

### `firstLine(text)` (L245–247)

First non-empty line, '' fallback (then the turn was filtered out anyway since scrubbed text is
non-empty by the `.filter(turn => turn.text)`). Correct.

### `useScrollToNewest(lastSeq, lastLength)` (L253–260)

Scrolls to bottom when the newest turn changes or grows — SPEC-mandated (even while the user
scrolled up; deliberate). Correct.

### `useBridgeEvents` / `useBridgeAnswer` / `useBridgeQuestion` (L263–343)

Identical shape: reset on no session; immediate read + 4s interval; `live` guard; interval
cleared; errors swallowed per SPEC ("a transport failure is not worth a banner"). `next ?? undefined`
maps the RPC's `null` to undefined. No leak, no stale-set. Verdict: correct.

## Bugs found

1. `L119`: the bridged `ChoicePanel` is not keyed by the question, and `bridgeChoiceRequest`'s id
   (`bridge:${sessionId}`) is identical for every question the session ever parks on — so when
   the cloud session moves on to a new, different question, the mounted panel keeps the previous
   question's state instead of starting fresh. Concrete scenario: session parks on multi-select
   Q1 (defaults: "Lint"), user ticks/unticks; session later parks on multi-select Q2 (defaults:
   "Docs") — Q2 renders with Q1's `checked` set, so Q2's defaults are not pre-ticked (SPEC:
   pre-tick per `default`), and (once the sent-state bug in ChoicePanel is fixed) an answered Q1
   would leave `sent` latched, parking Q2 forever. Contradicts ChoicePanel's own mount contract
   ("mount it with key={choice.id} so a re-fired gate resets state") and the SPEC's fresh-gate
   behavior. Severity: minor today (mitigated by the sent bug and single-select gates keeping no
   state), major once sent latches. Confidence: medium. Fix sketch: key the panel by the question
   content, e.g. `key={`${question.title}|${question.options.map(o => o.label).join('|')}`}` (a
   fingerprint that survives re-reports of the same parked question — `receivedAt` does NOT, the
   daemon refreshes it on every extension check-in).

2. (Recorded here, fix attributed to ChoicePanel L80 / `bridgeSend` L83): `bridgeSend` resolves
   `undefined` on success, so ChoicePanel never enters its parked "Choice sent…" state for bridge
   gates; combined with the ≤4s answer-poll latency the options re-enable and a second pick can
   race the first — exactly what the SPEC says must not happen. Severity: major. See
   `ChoicePanel.BUG-ANALYSIS.md` bug 2 (single JSON entry there).
