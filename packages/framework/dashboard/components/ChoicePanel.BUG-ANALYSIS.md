# Bug analysis: packages/framework/dashboard/components/ChoicePanel.tsx

## Business logic (high-level)

"Your call" — the interactive gate panel (#304/#332). One shape for every gate: title + options;
single-select renders one button per option with the recommended one emphasized, multi-select
renders checkboxes (pre-ticked per `option.default`) plus one Accept button that names its pick
count. A pick posts through `send` (bridge gates, #1554) or falls back to `sendChoice` → the
agent's control log. After a successful post the panel is supposed to stay parked ("Choice sent —
waiting for the agent to pick it up…", #948) until the `choice-resolved` event unmounts it.
`active` binds Ctrl/Cmd+Enter to Accept on exactly one gate (#440). `countdown` says whether the
autopilot auto-accept countdown may run (#1455) — off in the OpenQuestions hub and on
CloudAgentNotice, on in the event log.

Intent sources: `ChoicePanel.SPEC.md`; `ChoiceRequest` in `src/events.ts` (notably
`autoAcceptMs`: "Auto-accept the recommended option after this many ms when autopilot is on.
Default 10000."); `ChoiceBy = 'user' | 'autopilot' | 'auto'` ("the autopilot countdown");
`OpenQuestions.SPEC.md`/test ("the countdown that auto-accepts a gate's recommended option is
disabled ... in this hub" — implying it runs elsewhere); `CloudAgentNotice.SPEC.md` ("the
automatic-acceptance countdown does not run here"); `todo-loop.ts` ("the dashboard's autopilot
auto-accepts the per-item gate"). Consumers: EventList (inline, active on newest gate),
OpenQuestions (`countdown={false}`, `onAnswered` collapse), CloudAgentNotice
(`countdown={false}`, bridge `send`).

Two major findings, detailed under Bugs:

1. **The autopilot countdown does not exist.** All its scaffolding is present — the `countdown`
   prop, `secondsLeft`/`cancelled` state, the mousemove-cancel effect, the `checkedRef` whose
   comment says "the countdown's auto-accept fires from a closure captured when the countdown
   started", `accept(by)`/`post(by)` plumbing for `'autopilot'` — but no effect ever starts a
   countdown, `secondsLeft` is never set, `cancelled` and `countdown` are never read, no
   "Auto accept in Ns" ever renders (grep: only OpenQuestions.test asserts its *absence*), and
   nothing in the entire repo ever produces `by: 'autopilot'`. `choice.autoAcceptMs` is read
   nowhere in the dashboard.
2. **`sent` can never become true on the default (local) path.** Daemon `sendChoice` returns
   `Promise<void>`; the RPC transport (`lib/rpc.ts` → server `{ ret: await handler(...) }` with
   `JSON.stringify` dropping an undefined `ret`) resolves `undefined` on success; `useAction.run`
   passes that through; and the panel treats `result !== undefined` as the success condition.

## Functions (low-level)

### `ChoicePanel(props)`

State: `sent`, `checked` (multi pre-ticked defaults — correct init via lazy `useState`),
`checkedRef` (latest-value ref, standard pattern), `secondsLeft`/`cancelled` (dead, see bug 1),
`parked = busy || sent`.

### `post(pick, by)` (L76–86)

Builds `deliver` from `send` or the `sendChoice` fallback (agentId `?? undefined` for the
project-log fallback per #749), runs it through `useAction.run` (busy/error handling), then
`if (result !== undefined) { setSent(true); onAnswered?.(pick) }`. Bug: on BOTH paths the
resolved value is `undefined` *on success* (see Bugs #2) — the local `sendChoice` RPC is
`Promise<void>`, and the bridge sender (`CloudAgentNotice.bridgeSend`) is explicitly
`Promise<void>` too (it swallows `{ ok: true }` and throws on `ok: false`) — so the panel never
parks and `onAnswered` never fires in production. Error path correct: `run` catches, sets the "Could not send your
choice — try again." message, buttons stay usable (SPEC "refused pick is reported and retryable").

### `toggle(id)` (L88–93)

Immutable Set copy, add/remove. Correct.

### `recommendedId` / `autoPick()` / `accept(by)` (L97–99)

Recommended falls back to the first option per SPEC; `autoPick` reads `checkedRef.current` so a
countdown firing from an old closure would see live checkboxes (#948) — correct design, currently
only exercised by Ctrl+Enter. `recommendedId ?? ''` could post an empty id only for a zero-option
gate, which `events.ts` rules out ("at least one"). Correct.

### mousemove-cancel effect (L102–106)

`{ once: true }` listener + cleanup; sets `cancelled`, which nothing reads — dead code today,
belongs to the missing countdown. No leak (once + removeEventListener). Part of bug 1.

### Ctrl+Enter effect (L110–121)

Bound only when `active`; checks `!parked` via deps `[active, parked]` so the closure is fresh;
`preventDefault` and `accept()` on Ctrl/Cmd+Enter. The eslint-disable is justified (accept is
re-created per render but reads only live refs / per-mount constants). Correct.

### Render (L124–183)

Multi: checkbox list, Accept label "Accept none"/"Accept N selected" per SPEC. Single: option
buttons, recommended emphasized + "Recommended" tag. Status row: busy → "Sending your choice…",
sent → "Choice sent — waiting…", else the Ctrl+Enter hint when active. `role="region"`
aria-label'd by title. Matches SPEC copy. Correct in itself (but see bug 2 for why the
sent branch is unreachable, and bug 1 for the absent "Auto accept in" line).

## Bugs found

1. `L71` (and the unused `countdown` prop L25/L44, `cancelled` L72, mousemove effect L102): the
   autopilot auto-accept countdown is not implemented — `secondsLeft` is never set, no timer
   exists, `accept('autopilot')` is never called, `choice.autoAcceptMs` is honored nowhere, and no
   "Auto accept in Ns" status renders. Scenario: autopilot is on and the user is watching an agent
   (e.g. a todo-loop "start the next item?" gate in the event log, `countdown` defaulting true);
   intent (events.ts `autoAcceptMs` doc, ChoiceBy `'autopilot'`, todo-loop.ts, OpenQuestions/
   CloudAgentNotice SPECs that carve out where the countdown must NOT run) says the recommended
   option is auto-accepted after ~10s unless the user intervenes; instead the gate parks forever
   until answered by hand — `by: 'autopilot'` is dead across the whole system. Severity: major.
   Fix sketch: add an effect gated on `countdown && autopilotPreference && !parked && !cancelled`
   that seeds `secondsLeft` from `choice.autoAcceptMs ?? 10000`, ticks it down (1s interval),
   renders "● Auto accept in {secondsLeft}s…" in the status row, and calls `accept('autopilot')`
   at zero; mousemove-cancel and the existing `checkedRef` already support it.

2. `L80`: `result !== undefined` is the success test, but every real deliverer resolves
   `undefined` on success: the default `sendChoice` is a `Promise<void>` RPC — the transport
   resolves `undefined` (server writes `{ ret: undefined }`, which JSON-serializes to `{}`; the
   client returns `body.ret`) — and the bridge sender (`CloudAgentNotice.bridgeSend`) is declared
   `Promise<void>` and returns nothing on success. So on every successful pick, `setSent(true)`
   and `onAnswered` are skipped: the panel un-parks after `busy` clears (buttons re-enable,
   allowing a double-post — for bridge gates a real ~4s window until the answer poll swaps the
   question card out) and never shows "Choice sent — waiting for the agent to pick it up…" — the
   very #948 behavior the SPEC mandates ("once a pick is posted and the daemon accepts it, the
   options are disabled and the panel reports … it has been sent"). OpenQuestions'
   answered-collapse (#1455 bonus 2) also never fires in production. Tests miss it because they
   mock `sendChoice` to resolve `null`. Severity: major. Fix sketch: map a void success to a
   defined value inside the action, e.g. `run(async () => (await deliver(pick, by)) ?? true, …)`
   (keeps a `{ ok: false }` result flowing into `useAction`'s failure branch), or make
   `sendChoice`/`bridgeSend` return a value.
