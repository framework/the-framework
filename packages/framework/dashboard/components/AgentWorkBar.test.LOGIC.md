What the tests cover, for the bar above the message box of an agent's [1] page (`AgentWorkBar.tsx`):

- **What the row says** - the project's name, the branch without the `the-framework/` prefix every agent branch shares, what the branch holds and the next step button ("Open PR"), in that order, in one row named "This agent's work".
- **There with no next step** - with a branch and no next step the row is still drawn, saying the project and the branch, at its fixed height, so the message box never moves.
- **The pull request** - the branch's pull request is a link reading "PR #12", pointing at the pull request, with its state "open".
- **Before the branch is known** - while the agent's checkout is not read, and for a checkout that names no branch, nothing is drawn, whatever next step is handed in.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
