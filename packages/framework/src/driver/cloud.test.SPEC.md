What the tests cover: handing an agent's task to a cloud session on claude.ai through the browser extension, and reporting where it went.

- A hand-off asks the daemon for a session naming the repository from the GitHub remote, the pushed starting-point ref and the whole prompt, follows the request until created, and returns the session's id and a summary naming it; the session's link is published as an action the dashboard's agent view links through and carried onto the agent's record, and the log says the extension was asked.
- The prompt handed over leads with the user's task, followed by the system prompt framing and any per-turn framing, each behind a labelled rule; a task with nothing injected is handed over bare.
- An empty hand-off anchor commit is created on top of the checkout without moving any branch, pushed to the remote under the agent's own slash-free identifier before the request is made, the request names that ref, and the anchor is recorded on the agent's result. A push that fails stops the run naming the remote, with nothing asked of the extension.
- A checkout with no GitHub remote stops the run naming the need, before pushing anything; a run no daemon started stops saying web runs start from the dashboard; a daemon with no extension around, and one with the bridge off, each stop the run naming the cure; an extension that tried and failed stops the run carrying its note; waiting past the timeout stops the run naming the extension.
- An agent hands off exactly once no matter how many times the agent loop prompts it: one request, the same session on every later prompt, the link published once.
- Two agents never share an identifier; a disposed agent refuses further prompts; an agent already stopped fails before asking anything.
- A `web` agent exposes no file reading, since its workspace is in a cloud machine, and the `web` run target is hands-off while `local` and `actions` are not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
