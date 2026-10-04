What the tests cover, with real git in a throwaway repository that has no remote:

- **A merge with its checkout** - an agent's branch is merged into the default branch while that branch moved on in another file; the work is in the project's folder, the branch and its checkout stay, a file the agent keeps uncommitted in the checkout is untouched, and the answer names the last commit and where the work began; run again, it merges nothing and still removes nothing.
- **A fast-forward, and nothing to merge** - a branch whose checkout is gone fast-forwards the default branch with no merge commit; a branch already in the default branch is only deleted.
- **Refusals change nothing** - a conflict names the files and leaves the folder, the file and the branch as they were; uncommitted work in the agent's checkout, a folder on another branch and a branch that is not there are each refused.
- **Not an agent's branch, and the command line** - such a branch is merged and kept; the command answers the outcome as JSON, a refusal as one line on stderr with exit 1, and a missing argument with exit 2.
