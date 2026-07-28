Tests for `RoutineWork.tsx` — a large suite covering the routine list, Run now semantics, opt-outs, sweep trigger and concurrency.

## TLDR

- Lists every `AUTO_PM_ROUTINES` job by label; only jobs with `describe` get a subtitle (today the maintenance sweep alone).
- Run now on a rotation job starts the prompt verbatim as `unattended` (#1279) and reports the run id upward (#1191); no id still hands the project over for the adopt fallback; failures neither navigate nor stick on "Starting…".
- The drain job's Run now fires `sendAutoPmSweep({drainOnly: true})` — never a plain start, no navigation (#1204); a host with no sweep reports "nothing to trigger".
- Opt-out set semantics (#1209): all ticked by default, unticking records only that name, re-ticking preserves sibling opt-outs, Run now ignores the box, all-unticked + auto-run shows the empty-schedule warning.
- Countdown label only with auto-run on and a reported sweep; "Trigger routine now" works even with auto-run off (#1210).
- Concurrency box: shows `DEFAULT_AUTO_PM_CONCURRENCY`, clamps typed values to 1..MAX, ignores an emptied box (would save NaN/1), fine print follows the setting.

## Facts

- Mocks stop at lib modules (`../lib/preferences`, `../lib/quota`, `../lib/use-start-run`) — an unmocked `*.telefunc.js` in the import graph fails as an `assertIsNotBrowser` bug report.
- `AUTO_PM_ROUTINES[0]` is the drain job; plain-start tests deliberately click index 1 (first rotation job).
