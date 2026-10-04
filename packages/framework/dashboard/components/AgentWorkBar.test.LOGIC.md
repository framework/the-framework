What the tests cover, for the bar above the message box of an agent's [1] page (`AgentWorkBar.tsx`):

- **What the row says** - the project's name, the branch without the `the-framework/` prefix every agent branch shares, what the branch holds and the next step button ("Open PR"), in that order, in one row named "This agent's work".
- **Nothing to say, no bar** - told there is nothing to say, nothing is drawn, although the branch is known and a summary ("2 commits") and words for the end of the row ("Merged into main.") are handed in.
- **The pull request** - the branch's pull request is a link reading "PR #12", pointing at the pull request, with its state "open".
- **Before the branch is known** - while the agent's checkout is not read, and for a checkout that names no branch, nothing is drawn, although the bar is told there is something to say.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
