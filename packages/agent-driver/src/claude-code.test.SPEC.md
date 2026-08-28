What the tests cover: driving the Claude Code CLI and translating what it prints into the driver event stream.

- A turn's output becomes the agent's prose as text events and its tool calls as labelled action events, and the turn ends with the CLI's final message; if the CLI never produced one, the prose it streamed stands in instead. Output that is not the CLI's structured stream is ignored.
- The agent's session id is published on the very first line that carries it, not held back until the turn ends, so a turn stopped or killed mid-flight keeps its resume handle. It is published again only when it actually changes.
- The turn's usage — cost and input, output, and both cache token counts — is taken from the CLI's end-of-turn line. When the line reports tokens but no price, no cost is reported at all rather than a cost of zero, which spending limits would read as "free". A line reporting neither leaves the turn without usage.
- The CLI's per-turn rate-limit notice is passed through as where the account's quota stands and when it resets, converted to milliseconds, and it never disturbs the turn's own result. Values never seen before are passed through rather than dropped, while a notice missing any part that would be acted on stays silent, since a bogus reset time is worse than none.
- A turn that exits with a failure is reported as failed even when the agent streamed text first — the partial text never passes as a result.
- The CLI is invoked with file edits pre-approved, with the system prompt framing appended, and with the chosen model.
- A chat turn resumes the conversation the previous turn reported and skips re-appending the framing the resumed conversation already carries; an agent started with a recorded session id resumes it on its very first turn; asking to resume with no conversation to resume simply runs a fresh turn with the framing.
- When the CLI reports that the conversation being resumed no longer exists, the same prompt is immediately retried as a fresh conversation — which regains the framing — the user is told the history is gone, the message still lands rather than failing, and the next chat turn chains onto the new conversation. A turn that failed for any other reason is never retried.
- Extra tools wired in for an agent are written once per agent, reused across its turns, and cleaned up when it is disposed of; an agent with no extra tools configured gets none.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
