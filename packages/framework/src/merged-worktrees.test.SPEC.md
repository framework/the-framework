What the tests cover: which checkouts the sweep reclaims, what it says, and — against real git — that nothing is ever lost.

- Every retained checkout is offered to the one rule regardless of how its agent ended: a failed or stopped agent is not a reason to keep a checkout whose work is already on the remote, and the removal itself is what refuses when it is not.
- A live agent's checkout is never touched — stopping an agent is how it ends, not pulling the floor out from under it — and neither is a checkout the daemon has not finished with, which covers the window between an agent reporting itself done and its teardown finishing.
- A project with no remote is asked about that once per pass, no doomed push is attempted for any checkout, and every retained checkout is still reported as kept with that reason.
- A checkout that could not be reclaimed is reported with the reason it could not be.
- A project that cannot be listed at all sweeps nothing instead of failing, and a project whose sweep fails does not stop the projects after it.
- The loop reports, per project, what it removed and what it kept and why. A removal that left the branch alone says the branch and the agent's record are kept; a removal that took branches with the checkout names every one of them.
- A kept checkout is accounted for once rather than re-announced on every pass; a *changed* keep reason is announced again, because it means the situation changed; and a removal resets the accounting, so a checkout reappearing under the same identity is announced afresh.
- A stopped sweep does no further work.

Against a real repository with a real remote: an agent whose work reaches the remote loses its checkout while its branch, its commit, and the copy on the remote all remain; an agent with nowhere to push keeps its checkout; work the agent never committed is committed and pushed before anything is deleted, so it ends up on the branch and on the remote rather than destroyed; and a checkout that is already pushed is not pushed again but is still reclaimed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
