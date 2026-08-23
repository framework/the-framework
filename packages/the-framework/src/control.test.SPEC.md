What the tests cover for the control channel that carries steering into a running agent.

**Delivery.** Instructions appended to the channel reach the agent in the order they were written: Stop, a single-select pick, a multi-select pick, a handoff change, and the Merge action all round-trip intact, including who answered a gate — the user or autopilot.

**A fresh channel per agent.** Resetting empties the channel, and an agent that starts watching afterwards sees only instructions written after the reset, so a previous agent's picks can never replay into it.

**Nothing malformed gets through.** Unparseable lines, unrecognised instructions, a pick with no gate named, and a pick that is not text or a list of text are all dropped, while a genuinely empty multi-select pick is delivered. A chat message needs actual text — an empty one and one with no text at all are dropped — and unrecognised extra fields on an otherwise valid message are ignored rather than making it invalid. A handoff change is obeyed only when it names one of the four real rungs: a missing rung, an invented one, and the pair of switches the rung replaced are all dropped, so a half-written or stale line can never silently stop an agent from publishing its work.

**The framework's own directory stays untracked.** No runtime state under `.the-framework/` is committed to git — the only tracked files there are the ignore file, the layout marker, the log notes, the conversations, and each user's agent archive.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
