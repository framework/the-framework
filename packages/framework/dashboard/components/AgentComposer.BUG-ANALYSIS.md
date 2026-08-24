# Bug analysis: packages/framework/dashboard/components/AgentComposer.tsx

## Business logic (high-level)

One message box per agent, alive for the agent's whole life (#1026). Three send modes chosen at
submit time: live → `sendMessage` (queued control entry); ended+resumable (`!live && sessionId`)
→ `sendStart` with `resumeSession`+`continueAgentId` (a continuation of the same agent, same
branch, same driver); ended without a session id → plain `sendStart` (new agent). A
`newAgent: true` preset always starts its own agent regardless of state. The empty box's submit
slot doubles as the agent control: Stop while live, Resume once stopped-with-an-id, nothing
otherwise (SPEC: "ended any other way, or with no session id, leaves the slot empty").

Key invariants checked against `AgentComposer.SPEC.md`:

- **Continuation keeps driver, never re-chooses model** — `driverFromImpl(driver)` maps the
  recorded impl id (`claude-code`/`claude-web`/`github-actions` → `claude`) and only passes a
  `driver` option when it is not the default `claude`; no `model` option is ever passed. Matches
  SPEC and #831 tests.
- **Stop latch** — `stopping = stopBusy || (stopRequested && live)`; `stopRequested` resets when
  `live` drops or the agent id changes, so a resumed same-id agent gets a working Stop again
  (#762 regression covered by test).
- **Resume latch (#1460)** — `resuming` holds the busy Resume between the RPC resolving and the
  first live event; released on `live` or agent-id change. The slot condition
  `resumable && (outcome?.stopped || resuming)` keeps the Resume rendered while `outcome`
  momentarily reads undefined. Correct against the flicker scenario in the test.
- **Failure keeps text** — both `useAction.run` and `useStartAgent.start` return `undefined` on
  failure; `composerRef.clear()` only runs on success, so a failed send keeps the user's text as
  the SPEC requires.
- **Queued echo (#948)** — `queued` is set after a successful live send and rendered by `Note`
  while `live`. See bug 1: it is never cleared on agent change or resume, unlike the two latches
  next to it.

Concurrency/ordering: `send` guards on `busy || starting` so double submits are dropped;
`useAction` serializes state via its own busy flag. The three latches all reset via effects keyed
to `agentId`/`live`, which matters because `AgentView` (and `App.tsx`) never remount this
component across agent switches — the whole design leans on prop-keyed resets, so a piece of
state without one goes stale (bug 1).

Error surfacing: `error ?? startError ?? stopError` — one alert line; each `useAction` clears its
own error on the next run, but a *different* action's stale error is only replaced when that
action re-runs. E.g. a failed Stop's message stays on screen after a later successful message
send (the send clears `error`, not `stopError`). Cosmetic-only; noted, not reported.

## Functions (low-level)

- **`RESUME_MESSAGE` (const, L18)** — the stock resume text. Matches the SPEC's three required
  points (stopped-not-done, look at what was done and carry on, setReadyForMerge lifecycle).
  Correct.
- **`AgentComposer` (L40)** — see above. Props of note: `agentId` optional (falls back to project
  control log in `sendMessage`/`sendStop` via `agentId ?? undefined`); `sessionId` gates
  resumability; `outcome` drives the note wording. Correct except bug 1.
- **`send(text, _kind, opts)` (L101)** —
  - `opts.newAgent || (!live && !resumable)` → new agent via `start(projectId, text, 'prompt', {})`;
    clears+refocuses on success, navigates via `onAgentStarted`. Note the new-agent branch keeps
    kind `'prompt'` even when the Composer submitted `'build'` — same as the continuation branch;
    the mocked test submits `'build'` for `submit-normal` and the tests assert `'prompt'` reaches
    `sendStart`, so this coercion is intended (a continuation is a prompt run). Correct.
  - live branch: maps `sendMessage`'s void resolve to `true` so `useAction`'s failure
    `undefined` is tellable — correct; on success sets `queued` and clears.
  - continuation branch: only reachable when `!live && resumable`, so `sessionId as string` is
    safe; passes `continueAgentId` only when `agentId` is set; driver mapped per #831. Correct.
- **`stopSession` (L152)** — fire-and-forget wrapper with `.then(result => setStopRequested(true))`
  on success. `sendStop` resolves void → mapped to `true`. Correct.
- **`resume` (L160)** — guards `starting || !sessionId`; does not guard `resuming`, but the button
  is disabled while `resuming`, so unreachable through the UI. Sets `resuming` only on success —
  a refused resume keeps the slot pressable and surfaces the error (test-covered). Correct.
- **`idleControl` (L183)** — live → Stop (disabled while `stopping`, spinner + "Stopping…");
  stopped-with-id or latched `resuming` → Resume (disabled while `starting || resuming`); else
  `undefined` so the Composer collapses the empty slot to the send arrow. `starting` is shared
  with the typed-continuation flow, so a typed send also flips the Resume tooltip to "Resuming…" —
  consistent with `submitBusyLabel="Resuming…"`. Correct.
- **`Note` (L264)** — live: renders the queued echo unless muted by an error; not live: nothing
  when not resumable (the placeholder `NOT_CONTINUABLE` covers that state exactly once — asserted
  by the test that no `<p>` exists); resumable: failed (`!ok && !stopped`) → "Session failed…",
  `stopped` → "Session stopped…", else "Agent ended…". A crash is never called "ended" — matches
  SPEC. Correct except that the queued echo it renders can be stale (bug 1).
- **`NOT_CONTINUABLE` (L260)** — placeholder text for the ended-no-session-id state. Correct.

Edge cases considered and fine: empty `files` (passed through), absent `agentId` (project-log
fallback is deliberate, used by the adopting view in `App.tsx`), `driver` undefined
(`driverFromImpl(undefined)` → undefined → no driver option), `outcome` undefined while resumable
(→ "Agent ended — your next message continues it", the honest wording when the end event is not
in view yet).

## Bugs found

1. **L98: `queued` echo is never reset — stale "Queued — …" note on agent switch and on resume.**
   Scenario A: watch live agent A, send "do X" (note appears), then select live agent B from the
   rail — `AgentView`/`AgentComposer` stay mounted (no `key` anywhere from `App.tsx` down), and
   B's composer shows "Queued — the session reads it between turns: 'do X'" although nothing was
   ever queued for B. Scenario B: send "do X" to a live agent, it stops, press Resume — the
   moment the resumed leg reads live the old "Queued — do X" note reappears even though that
   message was drained (or died with) the previous leg. Contradicts the SPEC ("the dashboard
   repeats it **until then**" — until the agent reads it, for **that** send) and the file's own
   convention: the two sibling latches (`stopRequested` L82, `resuming` L91) both reset on
   `[agentId]` / `live` transitions precisely because the component is never remounted. Severity:
   minor (misleading UI text, no data loss). Fix: `useEffect(() => setQueued(null), [agentId])`
   plus clear it when `live` flips false (agent ended ⇒ the queue is gone), e.g. in the existing
   `if (!live)` effect.
