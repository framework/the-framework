What the tests cover:

- **No pill** - an agent with no events, a live agent, and an agent that ended clean show no status word at all.
- **The three words** - a stopped agent shows "stopped"; a failed one shows "failed", with the reason its ending carried appended as "failed — exit 1" when there is one; an agent that ended on its question shows that it waits for an answer, not "failed".
- **An answered agent** - once the agent goes on after waiting, it shows no pill again, because the leg it waited in is behind it; its next ending gets its own word.
