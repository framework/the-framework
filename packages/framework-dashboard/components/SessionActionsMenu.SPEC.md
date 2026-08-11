The session's one overflow menu: everything you can do to a session — open it on GitHub, in the file manager, an editor or the agent's own app, copy the terminal resume command, serve a preview, stop it, arm a merge, remove its worktree, delete it — instead of a row of icon buttons that came and went with the run's state.

## TLDR

- Items name what they will actually do: once a clean run's worktree is gone, the folder item says it opens the project folder, not "the session's folder" it can no longer reach.
- The agent's session id is shown because it is the only handle on the conversation outside the dashboard, and clicking it copies the command that reopens it in a terminal — recreating the by-then-deleted directory first, since that is how the CLI finds the session.
- Stop and "Merge when finished" exist only while the session is live; the merge is a pre-commitment honoured at the session's natural end, so once sent it reads "armed" rather than staying pressable.
- Delete asks to confirm — the session's history goes for good, though its branch and PR stay in git.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
