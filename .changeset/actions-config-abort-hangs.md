---
'@gemstack/the-framework': patch
---

A `--run-on actions` run that cannot start now fails instead of hanging forever as `running`. Missing a GitHub origin remote or a `GH_TOKEN` is caught before the driver starts, but that check sits after `run.json` has been written and before `settleRun` owns the run, so giving up there left the status at `running` with nobody to correct it — and the control tail the run had already wired kept the process alive, so it never exited either. From the dashboard that was a session stuck on "running" forever, with the real reason sitting unread in `stderr.log`. Both halves are fixed: the abort records an `end` event carrying the reason and releases the run's handles, and `followFile`'s `unref` option now covers the `fs.watch` handle as well as the poll timer, so opting out of holding the process open actually does.
