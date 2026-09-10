What the tests cover, against the streamed output of a real Codex run:

- **Reading the streamed output** - the last message Codex sends is the turn's answer, not the first, and the thread id is the turn's session id; every message surfaces as streamed text and every started work item as a tool use named by its kind only; a banner line, an empty line, a JSON `null` and the line opening the turn are ignored; a turn with no message answers with an empty final message.
- **Usage** - the token counts are reported and the price is absent, never zero; the cached tokens are split out of Codex's inclusive input total; reasoning tokens are not added to the output count a second time; a missing or malformed usage payload yields no usage; absent counts read as zero; a cached count above the input count cannot push the uncached input negative.
- **Running a turn** - a turn through the command resolves with the last message and the session id, reports the work item's kind as an action and closes with a `result` progress event.
- **The command line** - Codex runs in its non-interactive mode with JSON output, under the `workspace-write` sandbox, pointed at the driver session's directory, with its git repository check skipped, and never with the flag that bypasses its approvals and sandbox.
- **The prompt over standard input** - the prompt is fed to Codex over standard input and never appears as a command-line argument.
- **Framing ahead of the prompt** - the driver session's framing, then the turn's extra framing, then the prompt, as blank-line separated blocks.
- **Model pass-through** - the model the caller names reaches Codex's command line.
- **No quota reading** - the driver offers no quota reading rather than a made-up number.
- **A failed turn** - a non-zero exit fails the turn even though text streamed first.
