What the tests cover: which control channel a steering call from the dashboard lands in, and the rules around removing an agent's worktree.

- Stop, live chat messages and choice picks addressed at a given agent id are written to that agent's own control channel inside its worktree — the one file the agent is watching — and nothing is written at the project root.
- An agent whose worktree exists but which has not written its agent meta yet is still addressed at its worktree, so steering reaches an agent in its first seconds.
- A steering call with no agent id, or with an agent id that has no worktree (finished and cleaned up), falls back to the project's own control channel instead of failing.
- Removing a worktree is refused while that agent is still running, refused for an agent id that is not a safe directory name, and reported as an error when no worktree matches the agent id — never as a false success.
- Removing a worktree first commits and pushes the checkout's uncommitted work to the agent branch and its remote, so the removed work stays recoverable.
- The list of removable retained worktrees hides an agent that is still running and lists one that has finished.
- An agent that was continued after being archived reads as running once, not twice and not as its archived earlier leg.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
