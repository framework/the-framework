What the tests cover, for the read of an agent's [2] checkout [1]:

- **The agent's checkout** - there is no answer until the daemon's is in, then the answer is that agent's; the daemon is asked about that project and that agent.
- **Switching agents** - after a switch to an agent whose read has not answered, the first agent's answer is not given as the second's; switching back gives the first agent's answer from the first frame, remembered.
- **Read again when the turn changes** - the daemon is asked once on the first render and not again while the turn stays the same; when the turn ends it is asked again at once.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
