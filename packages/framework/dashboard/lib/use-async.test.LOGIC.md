What the tests cover:

- **Reading once** - the panel shows its empty state until the answer arrives, then shows the answer.
- **Nothing to read yet** - a panel with no subject makes no request at all, for a single read as well as for a polled one.
- **Re-reading when the subject changes** - the panel resets to its empty state rather than showing the previous subject's answer, then shows the new subject's.
- **A late answer is dropped** - a read still in flight when the subject changed never overwrites what is on screen, and neither does an on-demand refresh that lands after the panel is gone.
- **A failed read keeps the last answer** - the panel is not blanked, no failure escapes, and the next read recovers.
- **Reading on an interval** - the panel re-reads on its cadence, keeps polling through a failed read, and stops polling once it is no longer on screen.
- **Refreshing on demand** - an immediate refresh shows the new answer without waiting for the next interval.
- **Remembering answers per subject** - going from subject a to a never-read subject b shows nothing, never a's answer; going back to a shows a's last answer from the first frame, counted as read, while a is read again and its fresh answer then replaces it.
- **Nothing to read, nothing remembered** - a panel whose read turns off shows its empty state, not the answer remembered from before.
- **Keeping the previous answer** - a panel that opts to keep the previous answer still shows it after its subject changed, until the new answer lands.
- **No stale first frame** - every frame drawn after a switch, the first included, shows the new subject's remembered answer or nothing, never the previous subject's.
