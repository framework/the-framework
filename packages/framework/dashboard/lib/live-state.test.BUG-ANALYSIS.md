# Bug analysis: packages/framework/dashboard/lib/live-state.test.ts

## Business logic (high-level)

Pins the behaviours `live-state.test.SPEC.md` lists: view ordering/dedup/extra-field passthrough, gate open/resolve/multi/end-expiry, liveness incl. the resumed-segment rule (#762), the publishing window incl. affirmative arming and the resumed-window rule (#1450), the meta twin (#1455), current-segment slicing, outcome discrimination (#948), the Actions-run link, and settledness (#1173). Each claimed behaviour is genuinely asserted — the tests exercise the interesting orderings (gate after end reopens; arming from an earlier segment still counts while its handoff report does not close the new window; resumed agent has no outcome until its own segment ends).

Coverage gaps (noted, not bugs): `cloudSession` is exported and non-trivial (regex with id capture, last-wins) but has no test here; `agentViews`' first-seen order under an in-place update (update should NOT move the entry to the end) is only implicitly covered by the single-entry test. Neither invalidates any tested claim.

## Functions (low-level)

- `view`/`choice`/`resolved` helpers — well-formed `FrameworkEvent` literals; `choice` includes `options`/`recommended` so the stripped request shape is realistic. Correct.
- `agentViews` suite — order, in-place update, non-view filtering, extra-field passthrough (cast through `unknown`, deliberate). All assertions can fail if the behaviour regresses. Correct.
- `pendingChoices` suite — pending vs resolved, multi-gate order, discriminant stripped (`not.toHaveProperty('kind')`), end expiry with the post-end reopen case. Correct.
- `isAgentActive` suite — empty/streamed/ended plus the resumed case with two `session` boundaries. Correct.
- `isPublishing` suite — window opens only on clean+armed end; all three handoff outcomes close it; no window without arming / with `push:false` / unclean end; resumed window with old arming counting and old report not closing. The `armed`/`handoff` helpers cast through `as FrameworkEvent`, fine for a test. Correct.
- `isMetaPublishing` suite — open between clean end and folded report; closed for running/stopped/failed, push off, and a meta with no `handoff` key at all (destructured off). Correct.
- `currentAgentEvents` suite — no-boundary whole feed, single-run intact, previous run dropped, second run keeps its own end. Correct.
- `agentOutcome` suite — undefined mid-run, clean, failure+detail, user stop, and the resumed-agent no-outcome-until-own-end case. Correct.
- `actionsRunUrl` suite — extraction, absence before firing, non-run action (`Edit`) rejected, last-wins. Correct.
- `agentSettled` suite — settled sets, driver start clears and re-settling re-parks, end clears. The `as never` casts on the driver event are cosmetic. Correct.

All async-free pure-function tests; nothing to await, no fake timers needed. No test asserts a tautology.

## Bugs found

None found.
