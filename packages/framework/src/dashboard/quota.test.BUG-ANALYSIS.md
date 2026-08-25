# Bug analysis: packages/framework/src/dashboard/quota.test.ts

## Business logic (high-level)

Exercises `pollerQuotaSource` over a real `QuotaPoller` fed a scripted `DriverQuota` sequence with a controllable clock (`sourceOf`), so the poller's last-good/latest envelope semantics are integration-tested rather than stubbed. Covers the test SPEC completely: windows served as reported with `readAt`; the boundary moving with the clock and not the reading (same 50% falls under the line two days later, no new poll); a blip keeping the last good reading flagged `fetch-failed`; no reading → no windows, no boundary; an unplaceable week (no `resetsAtText`) → boundary absent rather than guessed; `stop()` stopping the poller; the default spend offset sitting `DEFAULT_SPEND_OFFSET` above the boundary; and the #1619 pair — the panel measuring the account week alone (a 100%-spent model week drawn but never tripping the bar), `boundaryFor('claude-fable-5')` bringing the Fable week into force and over the line, `boundaryFor('claude-opus-5')` (no window reported) gating on the account alone, and `boundaryFor()` equalling the panel's answer.

The fixture comment on `spentModelWeek` shows care against a self-masking test: the account week was moved *under* the line so the model-week effect is observable. Time anchors (`T0` = day 3 of a week resetting Jul 25) make the day-count assertions meaningful.

## Functions (low-level)

- **`week(percentUsed)` / `spentModelWeek()`** — driver-shaped fixtures with `resetsAtText` the boundary parser can place. Correct.
- **`sourceOf(script)`** — script index clamps at the last entry; one `at` variable drives both the poller's `now` and the source's, so reading time and measuring time cannot diverge. Correct.
- **Each test** — polls explicitly (`await poller.poll()`), advances time deliberately, asserts concrete fields (`boundary.day`, `reached`, `limit.offset/percent`, window labels via `deepEqual`). All awaited; all can fail. The `reached?.label` assertions tie the tripped window to a named one rather than mere truthiness — good.
- **"stopping the source ends the polling"** — asserts `poller.isStopped` after `source.stop()` without ever starting the interval (the tests only drive `poll()` manually), so no timer leaks from the suite. Correct.

Coverage note (not a bug): `defaultQuotaSource` (real driver + preferences wiring) is untested here — it shells out and reads the registry; covered indirectly by server/integration suites.

## Bugs found

None found.
