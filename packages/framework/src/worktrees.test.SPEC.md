What the tests cover: reclaiming an agent's checkout and deleting an agent, checked against real git because "was the work actually destroyed" and "did the branch survive" are the whole subject.

**Reclaiming a checkout**

- **Nothing local is ever the last copy** - a checkout holding an uncommitted edit is kept, says so, and has nothing committed or pushed on its behalf; a checkout whose agent committed its edit is reclaimed once the branch is pushed, and afterwards the edit is readable on both the branch and the remote.
- **Unrecoverable means untouched** - with no remote configured a committed checkout is kept, still holding its work, and the reason names the failed push.
- **Publish-nothing agents** - an agent whose handoff publishes nothing keeps its checkout even though the push would have succeeded, nothing reaches the remote, and its uncommitted edit is left exactly as the user left it — no commit is grabbed on the way to the refusal. The same agent whose branch someone already pushed by hand does let its checkout go, because removing what the remote already holds publishes nothing.
- **An unreadable record fails closed** - an agent record that exists but does not parse keeps the checkout and says so, rather than assuming the recoverable default and pushing.
- **Cloud agents** - a `web`-target agent with a clean tree whose branch is contained in its recorded hand-off anchor has its checkout reclaimed with no push at all, so no empty agent branch reaches the remote. The same agent with a dirty tree falls back to the ordinary rule and is kept, uncommitted, exactly as any other agent's would be.
- **A branch that holds nothing goes unpushed** - an agent whose branch tip the remote already has under another name has its checkout reclaimed with no push, and the branch is deleted with it. A clean checkout carrying a commit the remote has never seen is pushed instead and keeps its branch; a branch that was pushed under its own name keeps its local copy rather than reading as empty; and a leftover checkout sitting on a branch The Framework did not mint keeps that branch, empty or not.
- **A directory that is not a git worktree** - refused before any git runs in it, and reported as such. The user's own checkout is not committed, their uncommitted edit is untouched, nothing is pushed, and the directory is left where it is.
- **The branch the checkout was born on** - an agent that branched away onto its own `tf-<session name>` branch loses the `tf-agent-<agent id>` branch its checkout was created on, which is never pushed, while the branch it actually worked on stays and is pushed. An agent that commits nothing at all loses both branches and pushes neither. A `tf-agent-<agent id>` branch carrying a commit the kept branch lacks stays.
- **Unknown agents** - an agent id with no worktree on disk is refused before any git runs, and the real worktrees are untouched.

**Deleting an agent**

- **Records and checkout go, the branch stays** - deleting removes the agent's checkout, its meta and its event log, and the agent's row leaves the list; the agent branch and its commits remain.
- **Uncommitted work is discarded, not kept** - unlike reclaiming, deleting throws the agent away, so the branch keeps only what it had already committed.
- **An agent with no checkout left** - one whose worktree is already gone still has its row cleared.
- **A malformed agent id** - refused before anything is touched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
