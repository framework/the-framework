What the tests cover: handing an agent's task to a cloud session on claude.ai and reporting where it went.

- A hand-off returns the cloud session's id and a summary naming it, publishes the session's link as an action the dashboard's agent view links through, and carries the link onto the agent's record. The link is recognized even when it arrives split across the terminal's output in pieces, and even though the CLI draws it with terminal control codes around it.
- The CLI is stopped the instant the link appears, rather than being left holding its terminal.
- An agent hands off exactly once no matter how many times the agent loop prompts it: only the first prompt creates a cloud session, every later prompt returns the same session and says the work is already over there with nothing further to do locally, and the session link is published only once.
- The prompt handed over leads with the user's task, followed by the system prompt framing and any per-turn framing, each behind a labelled rule; a task with nothing injected is handed over bare.
- The project root is recorded as trusted for Claude Code before the hand-off, and the act is announced. An already-trusted root is left alone silently. A trust record that could not be written is reported and the hand-off still proceeds.
- If Claude Code's trust question appears anyway, the agent fails immediately naming the one-time manual fix, and both the failure and the notice name the project root rather than the throwaway worktree the user could never act on — including when the agent runs from a worktree, whose root is derived without guessing at unrelated paths.
- An empty hand-off anchor commit is created on top of the checkout without moving any branch, pushed to the remote under the agent's own slash-free identifier, and the cloud session is told to clone that ref; the anchor is recorded on the agent's result so its branch can be recognized later. A push that fails falls back to no ref, says so, names how to recover the work by hand, and still hands off — recording no anchor, since nothing reached the remote.
- Nothing the user typed reaches a shell as syntax: the prompt and model travel through the environment, the task sits directly after the cloud flag with nothing allowed in between, a plain model name is passed through, and an unsafe one is refused before anything is started at all.
- The CLI's non-essential traffic is switched off, which is what keeps the cloud session bound to the repository.
- A hand-off that created no cloud session fails carrying what the CLI actually said.
- Two agents never share an identifier; a disposed agent refuses further prompts; an agent already stopped fails before starting anything.
- A `web` agent exposes no file reading, since its workspace is in a cloud machine, and the `web` run target is hands-off while `local` and `actions` are not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
