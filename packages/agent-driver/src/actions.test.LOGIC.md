What the tests cover, against a stand-in for GitHub's API and a real action transcript:

- **A turn is a workflow run** - a turn dispatches the workflow, keeps polling while the run is queued and in progress rather than reading it early, and answers with the transcript's final message, session id and usage, price included.
- **The dispatch** - the workflow named in the configuration is dispatched on `main` with the driver session's framing, then the turn's extra framing, then the prompt as one blank-line separated input, and with a correlation id of `<driver session id>-turn-1`.
- **Unique correlation ids** - two driver sessions started in separate driver processes get different ids, so a fresh process never matches a stale run of the same name.
- **The run branch** - every turn asks the run to push to `claude/<driver session id>`, the same branch on every turn of the driver session.
- **Continuity through the branch** - the first turn is dispatched on `main` and the next on the branch the previous run reported back.
- **Continuing the driver session** - a turn that asks to continue passes the session id read off the previous transcript; a turn that does not passes none.
- **Model pass-through** - the model the caller names reaches the dispatch as the `model` input; a model id that could break out of the runner's shell is refused before anything is dispatched.
- **A red run** - a run that concludes with a failure fails the turn, naming the run's URL.
- **Giving up** - a run that never finishes fails the turn on the timeout instead of being polled forever.
- **Reading produced code** - a file is read from the branch the run pushed, not the default branch; before any run has pushed a branch, the reader is told so plainly.
- **Replaying the run** - the turn opens with a `start` progress event, replays the transcript's text and tool names, reports the run's link as an action and closes with a `result` progress event.
- **No quota reading** - the driver offers no quota reading.
- **The transcript** - the transcript is read by the Claude Code parser, announcing the session id before the conversation replays; an empty array is an empty turn; a transcript that is not a JSON array, or not JSON at all, is rejected rather than read as an agent that did nothing.
