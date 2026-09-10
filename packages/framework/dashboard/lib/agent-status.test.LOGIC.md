What the tests cover:

- **No pill until there is something to say** - an agent with no events, and an agent that has only logged its work, show no status word at all.
- **"building…" then a settled word** - an agent that has named its work shows "building…" while it runs and "finished" once it ends clean with nothing else to report.
- **"ready for merge"** - an agent that signaled ready for merge and then ended clean shows "ready for merge".
- **The ending outranks the signal** - an agent that signaled ready for merge and was then stopped shows "stopped"; one that signaled it and then failed shows "failed" with the reason its ending carried appended, as "failed — exit 1".
- **"publishing…"** - between a clean ending and the handoff's report, an agent armed to push shows "publishing…", and falls back to "finished" once the handoff reports. The window also outranks an earlier ready-for-merge signal: such an agent shows "publishing…" while the handoff runs and "ready for merge" after it reports.
- **When there is no publishing window** - an agent armed with the push rung off, an agent that never armed a handoff at all, and an agent that was stopped rather than ended clean all skip "publishing…" and show "finished" or "stopped".
- **A resumed agent** - resuming an agent puts the pill back to "building…", even when its earlier segment ended and its handoff already reported; the new segment gets its own "publishing…" window when it ends clean armed to push, and its own settled word after the new report. An agent resumed after having been stopped shows "building…" again rather than keeping the amber "stopped", and shows "finished" when the new segment ends clean.
