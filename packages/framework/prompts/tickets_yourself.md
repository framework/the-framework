# Tickets and the agent queue, without the command

The `tickets` command is not available here. The tickets and the queue described below live on the branch `tickets` of this repository; do with git what the command would do:

- Read: `git fetch origin tickets`, then `git show origin/tickets:<FILE>` (e.g. `origin/tickets:TODO_AGENTS.md`, `origin/tickets:tickets/<DATE>_<SLUG>.md`).
- Write, only when your instructions say to change tickets or the queue: commit the change on a checkout of `origin/tickets` (`git worktree add --detach <dir> origin/tickets`) and push it straight to the branch (`git push origin HEAD:refs/heads/tickets`); on a rejected push, fetch, rebase and push again. Never switch your own checkout to the branch, and never put these files on your own branch.
- Claim: a ticket is claimed by adding `tickets/<DATE>_<SLUG>.lock.md` holding `CLAIMED: <your branch name>`. If the push of the lock is rejected because that file now exists, someone else claimed the ticket first: back off and pick another; never remove or overwrite their lock.
