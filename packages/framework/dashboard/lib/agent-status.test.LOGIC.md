What the tests cover:

- **No pill with nothing to go on** - an agent with no events shows no status word at all.
- **"building…" then a settled word** - an agent that has said something shows "building…" while it runs and "finished" once it ends clean.
- **Stopped** - an agent whose events show it stopped shows "stopped", in the amber tone.
- **Failed** - an agent that failed shows "failed", with the reason its ending carried ("exit 1") kept apart from the word; a failure with no reason carries none.
- **A resumed agent** - an agent resumed after having been stopped shows "building…" again rather than keeping the amber "stopped", and shows "finished" when the new leg ends clean.
- **Waiting for an answer** - an agent that ended on its question shows that it waits for an answer, in the amber tone, not "failed"; once answered, the same agent shows "building…" again, because the leg it waited in is behind it.
