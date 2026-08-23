What the tests cover: the status reports the current branch, whether the tree has uncommitted changes, and the linked pull request; a path that is not a git checkout has no status at all; a failed pull request lookup degrades to no pull request rather than failing the status.

For an agent's checkout, the pull request is picked out of the branch's whole history: a merged pull request older than the agent — a predecessor's, on a reused pinned branch name — is not shown as the agent's own, while a pull request opened after the agent started is, whether it is open or already merged. A failed history read likewise degrades to no pull request, and does not claim the answer is still pending.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
