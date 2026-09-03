# Tickets and the agent queue, without the command

The `tickets` command is not available here. The tickets and the queue described below live on the branch `agent-data` of this repository; do with git what the command would do:

- Read: `git fetch origin agent-data`, then `git show origin/agent-data:<FILE>` (e.g. `origin/agent-data:TODO_AGENTS.md`, `origin/agent-data:tickets/<DATE>_<SLUG>.md`).
- Write, only when your instructions say to change tickets or the queue: commit the change on a checkout of `origin/agent-data` (`git worktree add --detach <dir> origin/agent-data`) and push it straight to the branch (`git push origin HEAD:refs/heads/agent-data`); on a rejected push, fetch, rebase and push again. Never switch your own checkout to the branch, and never put these files on your own branch.
- Claim: a ticket is claimed by adding `tickets/<DATE>_<SLUG>.lock.md` holding `CLAIMED: <holder>` — `$AGENT_ID` when your environment has it, else your branch name. If the push of the lock is rejected because that file now exists, someone else claimed the ticket first: back off and pick another; never remove or overwrite their lock.
