Effort: 1
Uncertainty: 2
Outdated: yes

# [Plan] Choices no working with CC web

Verify-and-close plan: everything this bug needs has already landed (#1234's hands-off fix, #1231's end-at-hand-off lifecycle, the #1237 bridge at v0.8.0); what remains is re-running the original repro against today's tree and closing #1225 on its evidence.

## TLDR

The bug had two visible halves, and both mechanisms are gone from the tree:

1. **The invented panel** (a choices card appearing before the web session even replied, identical every time): the cause #1234 identified — local gate machinery running against a run whose real agent is on claude.ai — is fixed. A `web` run is now *hands-off* (`src/agent-location.ts`): the first prompt is the whole agent, the backlog loop / review passes / chat park are all dropped (`src/agent.ts`, pinned by `agent.test.ts` "a hand-off run ends at the hand-off (#1225)"), and the cloud driver's turn text is a fixed hand-off summary that can never parse as an await gate (`src/driver/cloud.ts`). On top of that, `HANDS_OFF_PROTOCOL` (#1234, `src/system-prompt.ts` / `src/turn-gate.ts`) tells the cloud session the await gates are unavailable and to decide alone, so it should not emit gate blocks at all (#1518 hardened this into the closure instruction).
2. **The real question stranded on claude.ai** (the dashboard never updating, also after refresh): the #1237 browser-extension bridge is shipped at v0.8.0 — the extension scrapes the question off the session page, posts it to `/_bridge/question`, and `CloudAgentNotice` renders it with a pick-then-send answer path that the extension types back into the session's composer (`src/dashboard/bridge-endpoints.ts`, `bridge-store.ts`, `dashboard/components/CloudAgentNotice.tsx`, `packages/chrome-extension/*`).

No code is expected to be written for this ticket. The remaining work is a live re-test of the exact original repro (which needs the maintainer's browser + extension, so it cannot be done by a cloud agent), then closing GitHub issue #1225 and deleting the ticket files.

## Current state (what already landed, with evidence)

- **No local gate can fire on a web run.** `isHandsOff('web')` → the agent skips the todo loop, review passes and the open-chat park; the only turn is the hand-off, whose text is `CloudSession.report(...)` — a fixed summary containing no ` ```await-choices ` fence, so `parseAwaitGate` finds nothing and no `choice` event is ever emitted. Tests: `agent.test.ts` (#1225 hand-off lifecycle, #1234 hands-off protocol), `cloud.test.ts` (#1225/D1), `system-prompt.test.ts` (#1234 blocks).
- **The stale-after-refresh half follows from the same fix**: the panel persisted because a `choice` event without its `choice-resolved` sat in the agent's stored feed. Web runs no longer emit either, so there is nothing to persist or re-render.
- **The real interaction story exists**: bridge question report + transcript mirror + answer delivery with `queued`/`sent`/`failed` states and version-skew refusal (#1519, `EXPECTED_EXTENSION_VERSION = '0.8.0'`). The dashboard's honest fallback when no bridge is set up: `CloudAgentNotice` says the session "asks its questions and opens its own pull request over there, not here" (pinned by `CloudAgentNotice.test.tsx` #1225).

## Verification protocol (the remaining work)

Re-run the ticket's own repro, 3 attempts like the original report, from the dashboard with "Run on: Claude web":

1. **No invented panel**: after firing the prompt, the agent view must show the cloud hand-off notice — never a choices panel before/without the session actually asking one.
2. **No stale panel on refresh**: reload the dashboard mid-run and after the session finishes; no choices card may reappear for the web agent.
3. **Real question flows home** (bridge configured, extension v0.8.0 loaded, pinned claude.ai tab): craft a prompt that makes the session genuinely ask (or reuse a run known to ask), confirm the question shows in `CloudAgentNotice` within a few seconds, answer it, and confirm the answer state reaches `sent` and the session continues on claude.ai.
4. **Honest degraded mode**: with the bridge off, the notice must say questions are answered over there — no fake interactivity.

Criteria 1–2 are the bug itself; 3–4 confirm the replacement story so the close isn't "we removed the wrong panel and left nothing".

## Considerations

- **Old agents with persisted invented choices**: any pre-fix agent whose feed still carries the invented `choice` event will keep rendering it in its historical view. Per MEMORY.md's zero-migration decision, no cleanup code — old agents age out (and `bridgeSessionsFrom`'s 12 h window already ignores them).
- **#1265 / #1266 are not close blockers.** The unified-timeline work (question rows inline, one component for both transports) is UX consolidation tracked in `tickets/2026-07-27_unified-session-timeline.md`; this ticket is the *bug* (wrong choices shown / never updating), which is resolved without it.
- **Overlap with #1496** (`2026-08-03_cc-web-doesnt-work`): that ticket verifies web runs push and open PRs; this one verifies the choices surface. The same live batch evidence (e.g. this very plan being authored by a web run under #1518's closure instruction, with no gate emitted) partially covers criterion 1 already.
- **If a cloud session still emits an ` ```await-choices ` block** despite #1518 (model drift): the bridge mirrors the page, `content.js` extracts the question (its jsdom checks include our own protocol spec appearing as a decoy), and the answer path delivers — i.e. the failure mode degrades to "answerable over the bridge", not to the original bug. Extension-version skew is refused loudly at the daemon (#1519).
- **Why Uncertainty 2, not 0**: the live re-test could still surface a gap (e.g. answer delivery failing on the current claude.ai DOM — selector fragility is a known risk from `2026-07-27_web-runs-via-extension.md`). If it does, that is a new, narrower ticket against the bridge, not a reopening of the invented-panel bug.

## Implementation

1. Maintainer (or a local attended session) runs the verification protocol above.
2. On pass: close GitHub issue #1225 citing the re-test + the in-tree fixes (#1234, #1231, #1518, #1237/v0.8.0), and remove `tickets/2026-07-26_choices-not-working-cc-web.md` and this `.plan.md` — `tickets/` holds open tickets only.
3. On fail: file the specific observed failure (which criterion, session id, bridge contact state from the daemon's `/_bridge` bookkeeping) as its own ticket; mark this plan `Outdated: yes` only if the failure contradicts the analysis above rather than being bridge-delivery breakage.
