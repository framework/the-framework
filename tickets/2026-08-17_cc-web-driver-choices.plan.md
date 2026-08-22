Effort: 3
Uncertainty: 4

# [Plan] [CC web driver] Add support for choices? For full-fledged CC web driver

Yes, the gates can be piped through — the transport already exists end to end and is shipped; what blocks it is one deliberate sentence of prompt policy, so the work is a bridged variant of the detached-session rule, a bridge-liveness gate at spawn, and an unattended fallback that auto-answers a stale gate with its recommended option.

## TLDR

The ticket asks whether `await-choices` gates can reach the dashboard for "Run on: Claude web" runs. The answer is **yes, and cheaply**, because every hard part already shipped under #1237/#1265:

- The extension scrapes the question block off the claude.ai page (brace-matched, shadow-root-aware, decoy-hardened per #1568), posts it to `/_bridge/question`, and the dashboard renders it with a pick-then-send answer path that the extension types back into the session's composer (`packages/chrome-extension/content.js`, `src/dashboard/bridge-endpoints.ts`, `bridge-store.ts`, `dashboard/components/CloudAgentNotice.tsx`).
- What keeps this machinery dark is `HANDS_OFF_PROTOCOL` (`prompts/protocols/hands_off.md`): every web run's hand-off prompt tells the session "do not emit the await block and do not stop — take the option you would have marked `recommended`". The session obeys (#1225's 2026-08-17 re-test), so no gate is ever emitted and nothing reaches the pipe.
- The code anticipated exactly this ticket: the protocol's own doc comment says it is "worded as availability rather than as a rule, so it deletes itself cleanly once choices become a per-session capability" (`src/turn-gate.ts:19-25`).

So the plan is: (1) a **bridged** hands-off protocol variant that allows parking on single-select gates, chosen at spawn only when the daemon has measured a live, version-accepted bridge; (2) a daemon-side **auto-answer sweep** that resolves a gate nobody picked within a deadline to its recommended option through the existing answer path — so an unattended run still lands; (3) small dashboard/spec/copy updates. No extension change is required for v1.

This also answers the ticket's decision-forcer framing: the CC web driver investment does not hinge on new transport work — the remaining cost is prompt policy plus daemon plumbing, on the order of days.

## What exists today (evidence)

**The blocker is policy, not plumbing.**
- `composeAgentSystem({handsOff: true})` appends `HANDS_OFF_PROTOCOL` right after `AWAIT_PROTOCOL` for `location === 'web'` (`src/system-prompt.ts:268`, `src/agent-location.ts:39`, `src/agent.ts:149-155`); the composed system rides into the hand-off prompt as the labeled framing block (`src/driver/cloud.ts:154-160`, `:202`).
- The rule exists because a TF-started cloud session had *no* delivery channel when #1234 landed: parking meant parking forever, and the dashboard invented unanswerable panels. Both halves are fixed — the run ends at the hand-off (#1231, `agent.ts:239/253/269`), and the bridge now exists.

**The pipe is complete and hardened.**
- Question: `content.js` extracts `title` / `options[{label,detail}]` / `recommended` from the rendered block wherever the page hides it, with the run's own rendered prompt excluded as a decoy (#1568); the daemon validates hard and stores per session (`bridge-endpoints.ts:191-223`, `bridge-store.ts record()` with fingerprint dedup against re-reports and already-answered blocks).
- Answer: dashboard pick → `queueAnswer` (only a label the session itself offered can ever be typed, `bridge-store.ts:155-162`) → extension polls `/_bridge/answer`, types it into the composer, acks `/_bridge/answered` with `sent`/`failed` (`CloudAgentNotice.tsx:55-141`).
- Liveness is measurable in the daemon: `BridgeQuestions.lastContact()` records every authenticated poll, `version()` records whether the #1519 gate (426 on skew, `EXPECTED_EXTENSION_VERSION = '0.8.1'`) turned the extension away. The daemon process is also the process that spawns run children (`daemon-runtime.ts:643 onStart`), so bridge health is knowable exactly where the spawn decision is made.

**The agent lifecycle needs no change.** A web agent is `done` at hand-off and stays that way; the parked question hangs off the cloud `sessionId`, which `AgentMeta.sessionId` already joins (`bridge-store.ts:24-33`). Piping gates through does not mean wiring `CloudSession` turns into `drainGates` — the driver has no read-back and keeps its one-hand-off contract (`cloud.ts:163-175`); the gate rounds happen inside the cloud session's own conversation, over the bridge.

## Problems

### 1. When is a session allowed to park? — uncertainty 4

The ticket names the tension itself: the detached rule exists because parking with no delivery channel is a run that never lands. Options:

1. **Gate at spawn on measured bridge health** (recommended): the daemon includes the bridged protocol only when the bridge token is configured and an up-to-date extension polled recently (say, within 5 minutes — the extension's alarms beat at 30/60s). Otherwise the detached protocol ships exactly as today. Automatic, no new setting (consistent with "CLI options are minimal; settings belong to the dashboard" — and the bridge token setting already exists as the opt-in).
2. **Always bridged**: simplest, but a run started with no extension parks a session nobody will ever answer — strictly worse than today's decide-alone. Rejected as the default.
3. **A dashboard toggle**: one more knob, and a stale setting fails exactly like option 2. Only worth adding if the maintainer wants manual override; not in v1.

Residual race in option 1: the bridge is healthy at spawn and dies mid-run. Handled by problem 2's fallback plus honest dashboard states (below) — and it degrades to "answerable on claude.ai directly", never to an invented panel.

### 2. What happens when nobody answers? — uncertainty 5

A parked cloud session cannot wake itself; the resume has to come from outside. The mirror of the local headless rule (`requestChoices` falls back to `recommended`, marked `by: 'auto'`, `await-gate.ts:311-333`) is a daemon sweep: a question that has sat unanswered past a deadline, with the session demonstrably still parked, gets its recommended label queued through the existing `queueAnswer` path and typed in by the extension like any human pick.

Design points within that:
- **Deadline**: default on, something like 15–30 minutes. Off (park indefinitely) only makes sense with an attended-only bridge posture; the framework's own `recommended` semantics ("what the framework picks when nobody is there") argue for on-by-default.
- **"Still parked" must be checked before auto-answering**, or the daemon types a stale label into a session the user already answered directly on claude.ai. Two daemon-side signals, no extension change: no mirrored transcript event newer than the question, and the question still being re-reported by the scrape. Verify which of first-report time vs latest-report time `receivedAt` ends up carrying once the worker's dedup (`reply.skipped`) is in the loop — the sweep needs *first seen* for the deadline and *last seen* for still-parked, so `BridgeQuestions` likely grows a second timestamp.
- **No recommended in the scrape**: fall back to the first option, as `requestChoices` does (`await-gate.ts:313`).
- **Delivery impossible** (extension gone since the report): the queue entry just sits `queued`. Surface it — "waiting for your Claude tab" — rather than pretend; the question stays answerable on claude.ai, and the session link is already on the card.
- Mark the auto pick visibly (`BridgeAnswer` gains `auto: true`; daemon-internal, the `/_bridge/answer` wire shape is unchanged) so the dashboard can say "answered with the recommended option after Nmin, unattended" instead of looking like the user picked it.

### 3. What may a bridged session ask? — uncertainty 3

The bridge wire shape is single-select only: no `multi`, no `stop`, no `file` (`bridge-endpoints.ts:39-47`, `content.js:42-50`). Rather than grow the wire (extension bump, version-gate lockstep, dashboard checklist UI), v1 constrains the *protocol variant*:

- **Single-select only**: the bridged text says to fold multi-selects into one pick or decide them alone. A `multi` block the session emits anyway degrades to a one-label answer — annoying, not broken.
- **`stop` options allowed**, with adjusted semantics: locally a stop answer is never delivered (the turn simply ends, `await-gate.ts:139`); over the bridge the label *is* typed in, so the variant tells the session "an answer matching a stop-marked option means the user is taking over: stop working, leave the workspace committed, end your turn". The user finishes on claude.ai — which is where they would take over anyway.
- **No `file` sidebar**: no machine sees the cloud workspace, so a plan approval must inline the document (the session pastes it into the message above the gate; the mirror shows it). The variant says so explicitly.
- Everything else of `hands_off.md` survives verbatim — the commit/push/PR discipline is what makes a web run land, and a bridged run still must land.

### 4. Watched-tab capacity vs parked sessions — uncertainty 2

Delivery requires the extension to have a tab on the session, and `bridgeSessionsFrom` keeps only the newest 3 within 12h (`bridge-sessions.ts`) — its comment says recency is the only possible filter because "there is no read-back that would say which" session is parked. That is no longer true once the daemon holds parked questions: a 4th concurrent web run could evict a *parked* session's tab in favor of a finished one. Fix is one line of signal: sessions with a parked question sort ahead of the recency order (cap unchanged — raising it is #1332's spike's call, not this ticket's).

## Considerations

- **Where the spawn-time flag travels.** The dashboard spawns run children by re-invoking the CLI (`daemon-runtime.ts onStart`), and target already flows through resolved options (`registry.ts:98`). Bridge health joins the same path as an internal flag/env like `--run-id` — never a user-facing CLI option (MEMORY.md). `composeAgentSystem`'s input becomes three-valued (attended / detached / bridged) rather than a second boolean — zero users, prefer the clean shape.
- **Prompt-block plumbing is mechanical**: new `prompts/protocols/hands_off_bridged.md` → `gen-prompts` → `PROTOCOLS_HANDS_OFF_BRIDGED` → `turn-gate.ts` export → `system-prompt.ts` composition, with the existing test pattern (`system-prompt.test.ts:267-287`, `agent.test.ts` "This session runs detached" pin) extended to pin exactly one of the two variants ever appearing.
- **The decoy problem is already solved for the new text too, but verify it**: the bridged protocol will render on the session page including its example block; `content.js`'s #1568 checks (nothing inside the opening message counts, placeholder-shaped titles excluded, literal examples matched verbatim) must be re-run against the new wording in `check.mjs` — if the variant's examples differ from `await.md`'s two literals, the fixture list grows. This is the one place v1 could touch the extension after all; keeping the examples byte-identical to `await.md`'s avoids it.
- **Round cap**: local runs cap at `MAX_AWAIT_ROUNDS`; a bridged session has no enforcing loop. The variant's wording ("ask only decision-forcing questions") plus the auto-answer deadline bound it in practice; a hard cap is unenforceable without read-back and not worth simulating.
- **In-memory stays right**: questions, answers and the new sweep state all die with the daemon on purpose (`bridge-store.ts:30-33`); a restart re-learns parked questions from the extension's re-reports. The sweep must therefore tolerate `receivedAt` resetting on restart (worst case: the deadline restarts — acceptable).
- **Dashboard copy**: `CloudAgentNotice`'s "It asks its questions and opens its own pull request over there, not here" (`CloudAgentNotice.tsx:34`) becomes wrong for a bridged run; the notice should say questions will surface here when the session asks. The honest degraded line stays for detached runs. `ParkedQuestion` already renders the `recommended` tag; preselecting it is a nice-to-have.
- **Specs and features**: `FEATURES-SPEC.md` gains the feature line (web runs park on their choices when the bridge is live, with the unattended fallback); `system-prompt.SPEC.md`, `bridge-store.SPEC.md`, `bridge-sessions.SPEC.md`, `content.SPEC.md` (only if fixtures change) per sdd.md; `turn-gate.ts:19-25`'s "deletes itself cleanly" comment finally cashes in.
- **Interplay with #1332 (headless spike)**: the issue cross-links the two as the halves of "full-fledged CC web support", and they compose cleanly — a headless bridge on the daemon machine makes the delivery channel *always* healthy, which turns problem 1's spawn gate permanently on and makes the auto-answer fallback reliably deliverable. Nothing here assumes headless; everything here is what headless would drive.
- **Overlap with open tickets**: `2026-07-26_choices-not-working-cc-web.md` (its remaining work is the mirror re-test with a fresh extension — a prerequisite for this ticket's live probe); `2026-07-27_unified-session-timeline.md` (#1265/#1266 wants the bridged question rendered by the same component as local gates — UX consolidation, explicitly not blocking here); `2026-07-27_web-runs-via-extension.md` (shares the extension surface; check locks).
- **Quota**: live verification spends real cloud sessions; the shape of each probe (one session, one deliberate gate) should be scripted before burning any.

## Implementation

1. **Bridged protocol variant** (`prompts/protocols/hands_off_bridged.md` + generation + `composeAgentSystem` three-state input + tests): parking allowed, single-select only, inline documents, stop-answer semantics, "recommended must be safe — an unanswered gate is resolved to it after the deadline", landing discipline kept. Keep the example blocks byte-identical to `await.md`'s literals so the extension's decoy fixtures hold.
2. **Spawn gate**: `bridgeLive()` helper on the bridge store (recent authenticated contact + last version claim accepted); daemon passes the verdict to the run child through the internal options path; `location === 'web'` composes bridged vs detached on it. Tests at the daemon seam with a faked clock.
3. **Auto-answer sweep** in the daemon (ride the existing tick): deadline + still-parked check + `queueAnswer(recommended, auto)` + `BridgeAnswer.auto` + dashboard rendering of the auto state. Add the first-seen/last-seen timestamps to `BridgeQuestions` as needed. This is the largest new surface; test it store-level, no extension involved.
4. **Parked-first tab ordering** in `bridgeSessionsFrom` (daemon passes the parked session ids in).
5. **Copy + spec + FEATURES-SPEC.md updates** per Considerations.
6. **Live probe** (maintainer's browser, fresh v0.8.1+ extension — folds in #1225's pending mirror re-test): one web run whose prompt forces a gate → question surfaces in the dashboard → answered pick lands in the composer → session continues and opens its PR; second probe letting the deadline fire unattended. On pass, comment on #1554 answering the invest question with the evidence.
