What the tests cover: a panel shows its empty starting state until the daemon's answer arrives; with nothing to read yet, nothing is asked at all; changing what is being read clears the panel first rather than presenting the previous target's data as this one's, and an answer for the previous target that lands late is dropped; a failed read keeps the last answer instead of blanking it, and never surfaces as a crash.

For panels that read repeatedly: the answer refreshes on the panel's own cadence; refreshing stops once the panel goes away, and an answer still in flight then is never applied; a failed read is survived and the next attempt recovers; and an explicit re-read lands immediately rather than waiting for the next tick.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
