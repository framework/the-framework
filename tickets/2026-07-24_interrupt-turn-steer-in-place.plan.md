Effort: 5
Uncertainty: 4

# [Plan] Interrupt the current turn (steer in place), not only a hard Stop

Concrete plan for a soft `{kind:'interrupt'}` control entry that stops the in-flight turn via the CLI's own `control_request` interrupt and steers the same conversation, on top of the spike-validated stream-json input mode — the main open choice is persistent-process vs per-turn stream-json processes.

## TLDR

The spike settled the hard part: the installed CLI (2.1.219) supports interrupt-and-steer natively — `claude -p --input-format stream-json --output-format stream-json`, interrupt as a `control_request` on stdin (acknowledged with `{"subtype":"success","still_queued":[]}`), the interrupted turn ending with `result subtype=error_during_execution`, and a follow-up user message answered on the same process. No Agent SDK needed.

What remains is wiring, and it slots into seams that all exist today:

- **Driver** (`packages/the-framework/src/driver/`): teach the local Claude driver stream-json *input* (today only output), expose an optional `interrupt()` on `DriverSession`, and represent an interrupted turn as a settled-but-interrupted outcome instead of a rejected one.
- **Control** (`src/control.ts`, `src/cli.ts:850`): a new `{kind:'interrupt'}` entry beside `stop`/`message`; the run's control watcher calls the live session's `interrupt()` instead of `controller.abort()`. `stop` stays the hard kill.
- **Dashboard** (`src/dashboard-rpc/control.ts`, `dashboard/components/AgentComposer.tsx`): `sendInterrupt`, an Interrupt action on live runs beside Stop, focus back to the composer.
- **Steering after the interrupt needs no new machinery**: the live-chat queue (#714, `agent-messages.ts`) already delivers the next message into the same conversation. Interrupt merely accelerates reaching the between-turns drain point that already exists.

Note the ticket's worst consequence is already half-fixed: since #1322 the session id is announced on the *first* stream line, so even a hard Stop on the first turn no longer loses resumability. What interrupt adds over Stop today is (a) the turn ends gracefully inside the CLI (transcript intact, in-flight work not SIGKILLed mid-write), (b) the run stays live — no kill-and-respawn, no "stopped" state to resume out of, and (c) the CC-CLI-like steer flow the maintainer asked for ("TF as a transparent/thin layer on top of CC CLI").

## Problems

1. **Persistent process vs per-turn processes — uncertainty 5.** The spike ran one persistent process across turns; the driver today spawns one process per turn (`ClaudeCodeSession.prompt` → `runCliSession`) and chains chat turns via `--resume`. Both shapes can deliver the feature (see Solutions); they trade blast radius against cleanliness, and the choice restructures `cli-session.ts` either way.
2. **How the run loop reaches the live driver session — uncertainty 3.** The control watcher (`cli.ts:850`) today only knows the run-wide `AbortController`; `interrupt` must reach the *current* `DriverSession` (and be a no-op when no turn is in flight). Needs a small new seam — a mutable "current interruptible" handle registered by the turn runner — with a few placement options.
3. **What an interrupted turn *is*, upstream — uncertainty 4.** Today an aborted turn rejects, journal shows a failure or a clean stop, and the loop ends. An interrupted turn must settle as "turn over, session continues": partial text kept, no failed row, straight to the chat drain. Whether to resolve with an `interrupted` flag on `DriverTurn` or reject with a typed error the loop catches is a real representation choice.
4. **Interrupt with an empty message queue: park or end? — uncertainty 5.** #1390's contract is that a daemon-spawned session *ends itself* when the chat queue is idle. A user who clicks Interrupt intends to type the steer next — ending the session at that moment is technically fine (the composer reopens via `--resume`, #762) but defeats the point of staying live. The options differ in UX and in hang risk (see Solutions).
5. **In-flight tool call: abort vs finish — uncertainty 1 (resolved by stance).** The ticket lists it as open, but the black-box guardrail (#165) answers it: the CLI owns its loop, and `control_request interrupt` does whatever the CLI does (observed: turn ends with `error_during_execution`). TF should not grow a knob the underlying agent doesn't expose. If the CLI later adds a mode, inherit it.
6. **Non-Claude / non-local drivers — uncertainty 2.** Codex, ActionsDriver, CloudDriver and the fake can't interrupt. `interrupt()` is optional on `DriverSession` (like `readCode`/`readQuota`); the only real question is how the dashboard knows to show the button (see Considerations).

## Solutions

**Problem 1 — process shape.** Both start from the same new capability in `cli-session.ts`: speak stream-json on stdin (user messages + `control_request`) and treat a `result` line, not process close, as the turn boundary.

- *(a) Persistent session process (recommended — it is the ticket's and the spike's direction).* `ClaudeCodeSession` lazily spawns one `claude -p --input-format stream-json --output-format stream-json` child on first prompt and keeps it for the session's lifetime; `prompt()` writes a user message and awaits its `result` line (fresh `StreamJsonParser` per turn); `interrupt()` writes the `control_request`; `dispose()`/`stop` kill the tree exactly as today. Chat turns stop needing `--resume` chaining at all (the process *is* the conversation) — `--resume <id>` remains only for reviving a session across process/agent restarts (#720), passed at spawn. Cleanest end state ("one live conversation = one process", closest to CC CLI/web, and the project prefers clean code over compatibility); the cost is owning a long-lived child: crash-mid-session recovery (respawn with `--resume` on next prompt), the #778 conversation-gone retry moving to spawn time, and dispose paths that must never leak the tree (`child-registry.ts` already covers kill-on-exit).
- *(b) Per-turn processes, stream-json stdin (the meaningful shortcut).* Keep one process per turn and the whole `--resume`/#778 machinery byte-identical; just feed the prompt as a stream-json user message, keep stdin open, resolve on the `result` line, then end stdin so the child exits. `interrupt()` writes the `control_request` to the in-flight child; the interrupted turn ends with `error_during_execution`, the child exits, and the next message `--resume`s as chat already does. Much smaller diff, no long-lived child — but retains per-turn spawn latency, keeps two input framings alive, and is *not* "the driver goes persistent", so the post-MVP send-while-working affordance would target a per-turn child anyway. Fine as an MVP stepping stone if (a) proves hairy; don't build both deliberately.

**Problem 2 — reaching the live session.** *(Recommended)* the turn runner registers the in-flight turn's interrupt handle in a small mutable slot the control watcher closes over (mirroring how `pendingChoices` parks resolvers in `cli.ts`): `onInterrupt.current = () => session.interrupt()` around each `prompt()` await, cleared after. Interrupt with nothing registered is a no-op (plus a journal notice). Alternative: thread an `interrupt()` up through `runAgent`'s return/options — more plumbing through `agent.ts` for the same one call; rejected.

**Problem 3 — the interrupted turn's representation.** *(Recommended)* resolve, don't reject: add `interrupted?: true` to `DriverTurn`; the parser already accumulates `assistantText`, so the partial text is the turn text. The run loop treats an interrupted turn as settled — emit a notice ("turn interrupted"), skip outcome gating for that turn, fall through to the existing message drain. Rejecting with a typed `InterruptedError` also works but forces every `prompt()` caller (`agent.ts`, `await-gate.ts` chat phase, backlog loop) to grow catch-and-classify logic; the resolve shape keeps the loop linear.

**Problem 4 — empty queue after interrupt.**
- *(a) Interrupt parks the chat wait (recommended).* After an interrupted turn, the loop awaits `messages.next()` (held by the gate keepalive, #1359) instead of the end-on-idle path — the user said "stop, I'm about to redirect you", so waiting for the redirect is honoring the click. Bounded risk: if they walk away, the session sits parked exactly like `stayOpenChat` does; the Stop button still ends it.
- *(b) One combined entry `{kind:'interrupt', text}`* — composer sends interrupt+steer in one action, so an empty-queue interrupt can't happen and no parking rule is needed. Clean, but loses the two-step UX the ticket describes (interrupt first, then compose while the agent is stopped), and an Interrupt *button* alone still needs an answer.
- *(c) Do nothing special:* empty queue → session ends (#1390), steer message reopens via `--resume`. Zero new rules, but the run flips to "ended" the moment you interrupt, which reads as a kill — the thing this ticket exists to avoid.
- (a) and (b) compose: implement (a), and let the dashboard *also* send the message immediately if the user already typed one.

**Problem 6 — capability surfacing.** Simplest honest source: the agent meta already records the driver and target; show Interrupt only for a live, local, `claude` run in `AgentComposer.tsx`. A control entry arriving for a non-supporting session no-ops with a notice. A formal `capabilities` field on meta is over-engineering for one flag today.

## Considerations

- **`stop` stays the hard kill, unchanged.** Interrupt is additive; every existing surface (Stop button latch #1455, budget cap, Ctrl+C `armInterrupt`) keeps aborting the run-wide controller. Ctrl+C in a terminal-run session could arguably become a soft interrupt first — out of scope here, note it in the ticket if wanted.
- **`resetControl` at run start already protects against stale interrupts** replaying into a fresh agent, same as stale picks.
- **Relay:** `sendInterrupt` needs the same `relayOr` registration as `sendStop` (`dashboard-rpc/control.ts`, `relay-dispatch.ts`) so remote-device dashboards can interrupt too.
- **`--replay-user-messages`:** the spike used it to observe message acceptance; it echoes user messages back on stdout. Decide during implementation whether the echo is needed for transcript correlation or dropped for noise — not load-bearing either way.
- **Per-prompt system framing:** in persistent mode `--append-system-prompt` is fixed at spawn. Today only the first turn carries framing anyway (resumed/chat turns send text verbatim, `openingPrompt`), so nothing user-visible changes; per-turn `opts.system` (unused across turns today) would have to be prepended into the message text if ever needed.
- **Interrupt while parked on a choice gate:** no turn is in flight, so it's a no-op. Answering the gate (or Stop) remains the way out — do not overload interrupt to cancel gates; that's a different feature.
- **Autopilot / handoff composition (#799/#1102):** interrupt does not touch `armedHandoff`, `mergeAuthorized`, or auto-PM's busy accounting — the session simply stays `running`. Auto-answer countdowns don't race it: gates and turns are mutually exclusive states.
- **Send-while-working (maintainer's ideal, explicitly post-MVP-able):** once the process speaks stream-json stdin, a `message` entry arriving *mid-turn* could be written straight into the live child (the CLI queues it — that's what `still_queued` reports) instead of queuing TF-side. Design the input writer so this is a follow-up ticket, not a rewrite.
- **Codex symmetry:** `codex.ts` shares `runCliSession`; keep the stream-json input path Claude-specific (the parser/argv seam already separates dialects) so Codex's one-shot path stays byte-identical.
- **First-turn interrupt:** with stream-json output the `init` line carries the session id immediately (#1322), so an interrupted first turn is resumable under every option above.
- **Tests:** `cli-session.test.ts`/`claude-code.test.ts` have injectable `SpawnLike` fakes — extend them to script stream-json stdin/stdout exchanges (interrupt ack, `error_during_execution` result, process death mid-turn). The e2e steering story (`e2e/story-steering-and-gates.test.ts`) gets an interrupt leg.
- **Docs the repo requires:** every new/changed module needs its `SPEC.md` sibling kept true (sdd.md rules), and the Interrupt action is a user-facing feature → add it to `FEATURES-SPEC.md`.

## Implementation

Assuming 1(a) (persistent session process), 2/3 as recommended, 4(a)+(b) composed:

1. **Driver core** (`src/driver/cli-session.ts` or a new sibling `stream-json-io.ts` + SPEC): a persistent-child runner — spawn detached, register in `child-registry`, write NDJSON user messages, dispatch stdout lines to a per-turn parser, resolve a turn on its `result` line, reject on process death; `interrupt()` writes `{"type":"control_request","request_id":…,"request":{"subtype":"interrupt"}}` and resolves on the matching `control_response`. Keep `runCliSession` for Codex/fallback.
2. **Types** (`src/driver/types.ts`): `DriverSession.interrupt?(): Promise<void>`; `DriverTurn.interrupted?: true`.
3. **Claude driver** (`src/driver/claude-code.ts`): `ClaudeCodeSession` holds the lazy persistent child (`--input-format stream-json` added to `buildArgs`, `--resume <id>` at spawn when reviving #720); `prompt()` sends a message and awaits its result; move the #778 conversation-gone handling to the spawn/first-turn boundary; `dispose()` kills the tree.
4. **Control** (`src/control.ts` + tests): add `{ kind: 'interrupt' }` to `ControlEntry` and `isControlEntry`.
5. **Run loop** (`src/cli.ts`, `src/agent.ts`, `src/await-gate.ts`): current-interruptible slot registered around each driver turn; control watcher case `interrupt` → call it (no-op + notice when empty); interrupted turn settles, emits a notice event, and parks on `messages.next()` (keepalive-held) instead of end-on-idle.
6. **Dashboard RPC** (`src/dashboard-rpc/control.ts`, `relay-dispatch.ts`, `dashboard/rpc/control.ts`): `sendInterrupt(projectId, agentId)`.
7. **Dashboard UI** (`dashboard/components/AgentComposer.tsx`, `AgentActionsMenu.tsx`): Interrupt as the primary live action for local claude runs (Stop stays available — slot or ⋮ menu, keeping its #1455 latch), focus returns to the composer; a message already typed is sent right after the interrupt lands.
8. **Docs/tests**: SPEC.md siblings, `FEATURES-SPEC.md` entry, driver + control + e2e tests as listed in Considerations.

Suggested order: 1–3 behind the existing driver tests first (the risky half), then 4–7 (the small half, per the ticket), then 8 throughout. If 1(a) stalls, 1(b) delivers the same user-visible feature with steps 4–8 unchanged.
