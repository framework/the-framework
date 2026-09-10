What the tests cover:

- **Which checkouts are offered** - every retained checkout is offered to the removal rule whatever its agent's end (done or failed alike); a checkout whose agent the daemon is still finishing with is left alone; a live agent's checkout is never touched; a project that cannot be listed sweeps nothing rather than failing.
- **No remote** - the repository is asked once per pass, no checkout is probed or pushed, and every retained checkout is reported kept with "the repo has no remote; its worktree was kept".
- **A refused removal** - a checkout the rule keeps is reported with its reason, such as its branch not being on the remote.
- **What the sweep says** - a removal is announced with the branch and the agent kept; branches that went with the checkout are named; a kept checkout is announced with its reason; the same reason is announced once, not every turn; a changed reason is announced again; a removal clears the memory, so a checkout with the same id that reappears is announced again.
- **The pass over projects** - a stopped sweep does no further work; a project whose sweep throws does not stop the ones after it.
- **Against a real repository and a real remote** - an agent whose work reaches the remote loses its checkout and keeps its branch, with its commit on the branch and on the remote; with no remote the checkout stays; uncommitted work keeps the checkout, is left in place uncommitted, and is never committed on the agent's behalf; a branch already pushed is not pushed again and the checkout still goes.
