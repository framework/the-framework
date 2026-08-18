Covers worktree cleanup against real git: removal preserves a checkout's uncommitted work on the agent's branch and on the remote before deleting anything, refuses when the commit fails or the branch cannot reach the remote, keeps a publish-nothing session's unpushed checkout rather than pushing it — without committing its edits on the way to the refusal, while one whose branch already reached the remote still goes — keeps a checkout whose record exists but cannot be read, deletion clears the agent's records and checkout while the branch and its commits survive, record-only agents still delete cleanly, and unsafe or unknown agent ids are refused before anything is touched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
