Effort: 3
Uncertainty: 4

# [Plan] Nice demo Human Queue

Rehearse the exact on-camera path (Human Queue row → choices → pick → done), fix only the glaring paper cuts, and decide one real design question: whether the choices should appear in the Human Queue card itself instead of behind the click-through into the session.

## TLDR

Every piece of the demoed flow already exists and is wired end to end:

- `DashboardPage.tsx` renders the **Human Queue** card (`HumanQueue`, #632/#1139); an `awaiting` row is an agent parked on a choice gate (`src/dashboard/interventions.ts`, #636), and clicking it opens that agent's session.
- Inside the session, the open gate renders the interactive **ChoicePanel** inline in the transcript (`EventList.tsx`, #1455 item 6); picking posts over the control RPC, the panel parks ("Choice sent — waiting…"), and the `choice-resolved` event collapses it to the ✓ `AnsweredChoice` card.
- The queue row drops on the next dashboard poll (5s, `usePolled` in `DashboardPage.tsx`).

So this ticket is not a build — it is an untested-flow rehearsal plus targeted polish. The work is: seed a reliably-parked agent, walk the camera path, fix what is glaring, leave the rest (ticket explicitly allows non-glaring paper cuts).

## Problems

1. **Where the "list of choices" lives** (uncertainty 5). The ticket says "click Human Queue item => list of choices => I chose => done", which reads like the choices appear on click. Today the click opens the whole agent session and the choices are somewhere in the transcript/rail. That may demo fine — or feel like a detour on camera.
2. **Unknown paper cuts** (inherent uncertainty). The maintainer has not exercised the flow; the actual defects can only be enumerated by rehearsing. Likely suspects are listed under Considerations.
3. **Seeding the demo** (uncertainty 3). The flow needs an agent reliably parked on an `await-choices` gate at the moment of recording; there is no obvious "park an agent now" fixture.

## Solutions

Problem 1 — choices location:
- **A. Keep the click-through (current behavior), verify it lands well.** The session must open with the gate visible without scrolling/hunting. Zero new UI; the session view also shows the agent's context, which arguably demos *better* (you see what the agent was doing and why it asks).
- **B. Expand the ChoicePanel inline in the Human Queue card on click.** Matches the ticket phrasing exactly. Cheap: `OpenQuestions.tsx` (the launcher's questions hub, #1455) already renders `ChoicePanel` outside the session with `countdown={false}` and an `onAnswered` collapse — the pattern is proven and reusable.
- **C. Demo the existing OpenQuestions hub instead** of the dashboard card. No code change, but it sidesteps the surface the ticket names.

Recommended: rehearse A first; adopt B only if the click-through feels clunky on camera. Do not do both surfaces' worth of polish.

Problem 3 — seeding:
- **A. A trivial demo prompt** whose instructions guarantee an `await-choices` gate (e.g. "ask me which of three options to take before doing anything"). Real end-to-end, no new code; document it in a small `demo` note or script.
- **B. A fixture writing the gate event** into the project's event/control logs. Faster to trigger but risks demoing a state a real agent never produces; only worth it if A is too slow/flaky to record.

Recommended: A.

## Considerations

- **Auto-accept countdown must not fire on camera.** `ChoicePanel` defaults `countdown={true}` in the session rail; autopilot's auto-accept answering the gate mid-sentence would be a glaring demo failure. Any mouse movement cancels it, but verify the actual behavior (the countdown state in `ChoicePanel.tsx` looks partially vestigial — confirm what runs).
- **Landing on the gate.** After the click, the open gate should be on screen — check whether the transcript scrolls to it or the rail shows it without hunting. If not, that is the one fix most worth making.
- **"Done" latency.** Two waits shape the final beat: `choice-resolved` streaming in (collapses the panel to the ✓ card) and the 5s dashboard poll (drops the queue row, badge count decrements, empty state returns to "AI doesn't need you."). Confirm both feel prompt; the parked "waiting for the agent to pick it up…" state must not dwell.
- **The empty state is the closing shot.** Queue count badge → pick → count drops → "AI doesn't need you." is the natural on-camera arc; keep it intact.
- **Don't break the siblings.** Notifications (#627) and the Discord watcher fire off the same interventions set; `pr`/`unpushed` rows share the card. Polish must stay scoped to the `awaiting` path.
- **Fallbacks stay.** An awaiting row without `agentId` falls back to opening the project — keep that.
- **Scope guard.** The ticket allows non-glaring paper cuts; resist gold-plating. Fix only what would be visible in the recorded flow.

## Implementation

1. Seed: write down (in the repo, e.g. a short `demo` note next to the video assets or in the ticket) the demo prompt that reliably parks an agent on a 3-option gate.
2. Rehearse the exact camera path against a live dashboard: badge → row → click → gate → pick → sent → resolved ✓ → row gone → empty state. Note every hitch with a glaring/acceptable verdict.
3. Fix the glaring ones. Expected candidates, in likely order: scroll-to-gate on session open, countdown interference, resolved-latency. Each fix updates the matching `SPEC.md`/tests per repo convention.
4. Only if the click-through verdict is "clunky": add inline gate expansion to the `HumanQueue` card, reusing the `OpenQuestions` pattern (`ChoicePanel` with `countdown={false}` + `onAnswered` collapse), and update `DashboardPage.SPEC.md`.
5. Re-run the rehearsal once; stop when the flow records cleanly.
