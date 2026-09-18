What the tests cover:

- **No pill with nothing to go on** - an agent with no events and no card shows no status word at all.
- **"building…" then a settled word** - an agent that has said something shows "building…" while it runs and "finished" once it ends clean with nothing else to report.
- **A card alone** - an agent with no events yet whose card says running shows "building…".
- **"ready for merge"** - an agent that ended clean with a pull request on its card shows "ready for merge"; one still running with a pull request on its card shows "building…".
- **The ending outranks the pull request** - an agent stopped with a pull request on its card shows "stopped"; one that failed with a pull request on its card shows "failed" with the reason its ending carried appended, as "failed — exit 1".
- **"publishing…"** - an agent that ended clean with its card marked publishing shows "publishing…", with or without a pull request; without the mark it shows "ready for merge" with a pull request and "finished" without one.
- **The event stream says how the leg ended, the card when the stream shows none** - an agent whose events show it stopped shows "stopped" though its card still says running; with no events, a card saying failed shows "failed", one saying waiting shows that it waits for an answer, and one saying done with a pull request shows "ready for merge"; an agent whose events never ended shows "failed" when its card says failed.
- **A resumed agent** - an agent resumed after having been stopped shows "building…" again rather than keeping the amber "stopped", and shows "finished" when the new leg ends clean.
- **Waiting for an answer** - an agent that ended on its question shows that it waits for an answer, in the amber tone, not "failed"; once answered, the same agent shows "building…" again, because the leg it waited in is behind it.
