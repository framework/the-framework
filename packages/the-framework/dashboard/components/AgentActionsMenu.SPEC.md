The agent's one overflow menu: everything the user can do to an agent — open it on GitHub, in the file manager, an editor or the driver's own app, copy the terminal resume command, stop it, arm a merge, remove its worktree (the agent's own checkout), delete it.

## Flows

- Items name what they will actually do: once a clean agent's worktree is gone, the folder item admits it opens the project folder, not an agent folder it can no longer reach.
- The driver's session id is shown because it is the only handle on the conversation outside the dashboard. Clicking it copies the command that reopens the conversation in a terminal; the command recreates the vanished directory first, because the driver's CLI finds a session by the directory it ran in.
- Stop and "Merge when finished" exist only while the agent is live. The merge is a pre-commitment honoured at the agent's natural end, so once pressed it reads "armed" rather than staying pressable.
- Deleting asks the user to confirm first — the history goes for good; the branch and PR stay in git.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
