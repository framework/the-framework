The session's one overflow menu: everything you can do to a session — open it on GitHub, in the file manager, an editor or the agent's own app, copy the terminal resume command, stop it, arm a merge, remove its worktree, delete it.

## TLDR

- Items name what they will actually do: once a clean run's worktree is gone, the folder item admits it opens the project folder, not a session folder it can no longer reach.
- The session id is shown as the only handle on the conversation outside the dashboard; clicking it copies the command that reopens it in a terminal, recreating the vanished directory first, since that is how the agent's CLI finds the session.
- Stop and "Merge when finished" exist only while the session is live; the merge is a pre-commitment honoured at the session's natural end, so it reads "armed" rather than staying pressable.
- Delete confirms first — the history goes for good; the branch and PR stay in git.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
