What the tests cover: an agent on the `actions` run target dispatches its workflow, keeps polling while the run is queued and in progress, and turns the run's uploaded transcript into a finished turn with the agent's final message, its session id, and its usage figures.

- The prompt is dispatched with the system prompt framing in front of the task text, plus a per-turn correlation id that is the only way back to a run GitHub reports no identifier for; two sessions never share a correlation prefix, so a freshly started daemon cannot latch onto another agent's run.
- Each run is asked to push to the same branch for the whole agent, and every turn after the first is dispatched from the branch the previous run pushed, so later work builds on earlier work.
- A follow-up turn asking to resume carries the agent's session id from the previous turn; the first turn carries none.
- The chosen model is passed through, but a model name containing anything that could break out of the runner's shell refuses the turn instead of dispatching it.
- A run that concludes red fails the turn and names the run's URL; a run that never finishes gives up rather than polling forever.
- Files the agent produced are read from the branch the run pushed, not from the default branch, and asking before any run has pushed reports that plainly.
- The dashboard gets the same event stream as a local agent — the agent's text, its tool calls, and a link to the run — all arriving at once when the run completes.
- This driver reports no quota at all.
- A transcript that is not a recognizable message list is rejected rather than passing as an agent that did nothing; a genuinely empty transcript is accepted as an empty turn.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
