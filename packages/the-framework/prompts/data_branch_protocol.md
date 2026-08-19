# The data branch

The framework's own data — `tickets/**.md` (plans and locks included), `TODO_AGENTS.md`, the session archives — lives on the dedicated branch `tf-data`, never on code branches. Your checkout does not contain these files.

Read them off the branch (fetch first): `git show tf-data:<FILE>` — `origin/tf-data:` when the local branch doesn't exist.

Write them, only when the instructions say to edit tickets or the queue, as a commit on `tf-data` pushed immediately — rebase and retry on a rejected push. Never switch your checkout to the branch, and never put these files on your session branch: a data change is pushed directly, it does not ride your PR.
