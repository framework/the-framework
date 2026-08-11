Covers worktree cleanup against real git: removal preserves a retained checkout's uncommitted work on the session branch and refuses when committing fails, deletion clears the session's records and checkout while the branch and its commits survive, record-only sessions still delete cleanly, unsafe or unknown session ids are refused before anything is touched, and the list renders readably.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
