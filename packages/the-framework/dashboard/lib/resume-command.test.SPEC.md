What the tests cover: the command that reopens an agent's driver session in a terminal. It recreates the directory the agent ran in before resuming, since the worktree is usually gone by then and the coding-agent CLI matches a session by that directory. With no directory recorded it hands over the bare session id instead. With no session id — including no agent at all — there is nothing to offer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
