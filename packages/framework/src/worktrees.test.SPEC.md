What the tests cover: the agent's side of reclaiming a checkout — what its record allows, and how a refusal is said — and deleting an agent, checked against real git because "was the work actually destroyed" and "did the branch survive" are the whole subject. The git rule itself is covered where it lives, in the branch-management package.

**Reclaiming a checkout**

- **Unrecoverable means untouched** - with no remote configured a committed checkout is kept, still holding its work, and the reason says the branch is not on the remote.
- **Publish-nothing agents** - an agent whose handoff publishes nothing keeps its checkout even though the push would have succeeded, nothing reaches the remote, and its uncommitted edit is left exactly as the user left it — no commit is grabbed on the way to the refusal. The same agent whose branch someone already pushed by hand does let its checkout go, because removing what the remote already holds publishes nothing.
- **An unreadable record fails closed** - an agent record that exists but does not parse keeps the checkout and says so, rather than assuming the recoverable default and pushing.
- **Cloud agents** - a `web`-target agent with a clean tree whose branch is contained in its recorded hand-off anchor has its checkout reclaimed with no push at all, so no empty agent branch reaches the remote. The same agent with a dirty tree falls back to the ordinary rule and is kept, uncommitted, exactly as any other agent's would be.
- **A directory that is not a git worktree** - refused before any git runs in it, and reported as such. The user's own checkout is not committed, their uncommitted edit is untouched, nothing is pushed, and the directory is left where it is.
- **Unknown agents** - an agent id with no worktree on disk is refused before any git runs, and the real worktrees are untouched.

**Deleting an agent**

- **Records and checkout go, the branch stays** - deleting removes the agent's checkout, its meta and its event log, and the agent's row leaves the list; the agent branch and its commits remain.
- **Uncommitted work is discarded, not kept** - unlike reclaiming, deleting throws the agent away, so the branch keeps only what it had already committed.
- **An agent with no checkout left** - one whose worktree is already gone still has its row cleared.
- **A malformed agent id** - refused before anything is touched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
