Effort: 0
Uncertainty: 2

# [Plan] Unified session timeline: one interactive row design for both local and web runs

Close-out audit: everything the umbrella asked for is built on `main` (or deliberately superseded by SPEC-recorded decisions) — recommend closing #1266 with no code change.

## TLDR

Verified against `main` (2026-08-24), item by item. The children (#1263–#1265) are closed, and the "polish left" that both the ticket's triage note and the curated comment on #1266 still list as open — inline question rows and row-kind colours — has in fact landed too:

- **One timeline of typed rows, interactive in place** — `EventList.tsx`: an open gate row IS the interactive `ChoicePanel` (#1455 item 6, PR #1482), an answered one collapses to the `AnsweredChoice` ✓ card; the latest `browser` row hosts the live pane (`InlineBrowser`, #1455 item 6b); the cloud mirror is one live boxed row riding the timeline's tail (`CloudMirrorRow`, #1265).
- **One component for both modes, only the submit path differs** — `ChoicePanel` takes a swappable `send`: local picks go through `sendChoice`, a bridged question posts through `bridgeSend` → extension fill-and-send (#1237/#1554). Same panel, same options, same recommended marking, same multi-select — `ChoicePanel.SPEC.md` states this as the design ("a cloud session's question is a question like any other").
- **Row-kind colours** — badge tones (#1487 / #1455 follow-up): QUESTION amber (`choice`/`choice-resolved`), BROWSER primary (`browser`/`browser-stream`/`view`/`preview`), milestones green, failures red, YOU blue; plus the #1508 background wash on the three rows the eye hunts for. The cloud surfaces carry the primary-tinted Cloud icon on the notice and the mirror box.
- **Open-session fallback** — "Answer it in the session" link on the parked question, "Open the session" on the notice and on the answered state.

The maintainer asked "Still relevant?" on #1266 (2026-08-24) and the curated reply already recommends closing. This audit confirms the recommendation and adds the part the curated comment understates: the residual polish it names is not left, it's shipped. Recommendation: close #1266, remove the ticket + this plan + the lock from `tickets/`.

## Where the built thing deviates from the ticket's letter — all deliberate, none worth reopening

The umbrella was written 2026-07-27; four of its parenthetical details were settled differently later, each recorded in a SPEC or issue:

1. **"Real radios/checkboxes + an Answer button"** — single-select gates render each option as its own button (click = answer); only multi-select uses checkboxes + an Accept button. Settled in `ChoicePanel.SPEC.md` ("One shape for every gate"): fewer clicks than radio-then-Answer, and one shape replaced the old three-shape zoo. The ticket's actual point — inline, identical in both modes — holds.
2. **"The right-rail Choices tab stays as a shortcut"** — the tab was *removed* when gates moved inline (#1455 item 7; `RightRail.tsx` comment records it). Superseding decision: the inline gate plus the pooled `OpenQuestions` list on the launcher cover both uses; a third surface bound to the same state was redundancy, not a shortcut.
3. **"A 'via claude.ai' chip"** — realized as explicit wording instead: the queued state says "Sending … through your Claude web tab", the answered state says the session continues over there, both with session links (`CloudAgentNotice.tsx` `AnswerState`). Same information, one register up from a chip.
4. **Web question placement** — the bridged question renders in the `CloudAgentNotice` strip directly above the feed, not as a row *inside* it. Structural reason (recorded in `CloudAgentNotice.SPEC.md`): the bridge writes over HTTP from the extension and never touches `events.jsonl`, so there is no event to carry a row, and a web agent's log dead-ends at the hand-off anyway — "the point in the timeline where it was asked" doesn't exist in the durable log. The panel itself is the same component, which is what the ticket was after.

If the maintainer disagrees with any of these four, that's a new, sharply-scoped ticket against the relevant SPEC — not a reopening of this umbrella, whose direction (one timeline, one gate component, scannable row kinds) is delivered.

## Considerations

- **Verified in code, not from issue state**: `EventList.tsx` (`foldChoiceRows`, `foldBrowserRows`, `badgeTone`, `rowWash`, `tail`), `ChoicePanel.tsx` (`send` prop, `inline`, active-gate Ctrl+Enter), `CloudAgentNotice.tsx` (`ParkedQuestion`, `AnswerState` with cancel-while-queued, `CloudMirrorRow` with chrome-scrubbing), `AgentView.tsx` (notice above the feed, mirror as `tail`), `RightRail.tsx` (Choices tab gone). SPECs: `EventList.SPEC.md`, `ChoicePanel.SPEC.md`, `CloudAgentNotice.SPEC.md`.
- **No CLOUD badge lane in the log** — the ticket's "QUESTION / BROWSER / CLOUD scan at a glance" is met for QUESTION and BROWSER by badge tones; CLOUD scans by shape instead: the mirror is the only boxed row in the timeline, headed by a primary-tinted Cloud icon and an uppercase "CLOUD SESSION MIRROR" label. There is no plain cloud event row to tint (`cloud-anchor` is internal ancestry plumbing, never rendered). Nothing to build here.
- **The curated comment on #1266 is slightly stale**: it says "only polish left (inline rows, row colours) — close it". The close recommendation stands, but the framing undersells it — that polish shipped (#1482, #1487, #1508). Worth stating on the issue when closing, so the record shows it was finished, not dropped.
- **Close-out mechanics**: close #1266 (state_reason `completed`), remove `tickets/2026-07-27_unified-session-timeline.md`, this `.plan.md`, and the `.lock.md` from the `tf-data` branch per the ticketing format.

## Implementation

None — no code change. Close-out only:

1. Comment on #1266 that the full direction is delivered (children closed, inline gates #1482, colours #1487/#1508, one `ChoicePanel` for both transports #1237/#1554, mirror row #1265) with the four letter-level deviations above noted as settled SPEC decisions; close as completed.
2. Remove the ticket, this plan, and the lock from `tickets/` on `tf-data`.

Uncertainty 2, not 0, only because closing an umbrella whose letter deviates in four places is the maintainer's call to confirm — the thread already points that way ("Still relevant?" → curated "close it"), so no further human round-trip is needed unless the maintainer objects to one of the deviations.
