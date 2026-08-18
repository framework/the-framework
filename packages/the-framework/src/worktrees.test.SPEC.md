Covers worktree cleanup against real git: removal preserves a checkout's uncommitted work on the agent's branch and on the remote before deleting anything, refuses when the commit fails or the branch cannot reach the remote, deletion clears the agent's records and checkout while the branch and its commits survive, record-only agents still delete cleanly, and unsafe or unknown agent ids are refused before anything is touched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
