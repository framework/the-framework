"Your call" — one interactive gate the run is parked on (#304/#332), rendered from the live event stream and answered over Telefunc.

## TLDR

- Three shapes from `ChoiceRequest`: an Approve/Decline confirm (#358), a multi-select checklist (#332), and a single-select list with a Recommended option (#304).
- Posts the pick via `sendChoice(projectId, choice.id, pick, by, runId)` (`server/control.telefunc.ts`) into the project's `control.jsonl`; `by` is `'user' | 'autopilot'`.
- After posting, the panel stays "parked" (buttons disabled, status line shown, #948) until the `choice-resolved` event streams in and the parent's `pendingChoices` drops it — the panel never unmounts itself.
- Autopilot (#433): while the preference is on, counts down `choice.autoAcceptMs` (default 10s) then auto-accepts the recommended pick; ANY mouse movement cancels (the human is here, let them pick). The Autopilot checkbox writes the shared preference (same one the Start form uses, #410).
- `active` (only the first gate in the rail, #440) binds window-level Ctrl/Cmd+Enter to Accept, so the shortcut is unambiguous with several gates open.
- `countdown={false}` (#1455) turns the autopilot auto-accept off for this mount: the launcher's questions hub renders every parked session's gate at once, and a page that answers them all ten seconds after opening is a mass auto-accept, not a hub. Default true — the session's own rail keeps today's behaviour.
- `onAnswered(pick)` (#1455 bonus 2) fires once a pick is posted and accepted (same condition as `sent`), with what was picked — the hub collapses the answered card on it. Optional.
- `inline` (#1455 item 6): the transcript's choice rows mount the panel as a rounded card in the flow rather than a full-bleed rail section — container styles only, behaviour identical.

## Decisions

- Mount with `key={choice.id}` (caller contract) so a re-fired gate resets all local state.
- The multi Accept label spells out what it will post ("Accept none" / "Accept N selected") so an empty pick is a choice, not a surprise.
- Confirm's Approve id is `choice.recommended ?? options[0]`; Decline is the first other option.
- Approve uses `text-background` on `bg-success`, not white: the success token inverts between themes, so the label must invert with it.

## Facts

- `checkedRef` mirrors the checkbox state because the countdown's auto-accept fires from a closure captured at countdown start (#948) — the ref keeps it reading the boxes as they are at fire time.
- The countdown restarts if Autopilot is toggled back on before a pick; it stops while `parked`.
