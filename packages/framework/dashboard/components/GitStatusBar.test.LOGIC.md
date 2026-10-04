What the tests cover, for the line of git facts about the checkout [1] in play:

- **Whose checkout** - on the project home the project's own checkout is read, showing its branch and "clean", and no agent's [2] checkout is asked for; with an agent selected that agent's checkout is read instead, showing its branch, "dirty", and what only an agent's checkout has, such as its size on disk ("5 MB").
- **An agent's page** - given the agent's name, the line shows the name and "dirty", and neither the agent's branch nor its pull request ("PR #12"), which the bar above the message box says.
- **Given the checkout, it reads nothing** - handed the checkout by its caller, the line shows no "clean" or "dirty" while the caller's read has not answered, shows "clean" once handed a clean checkout, and asks the daemon about neither the agent's checkout nor the project's.
- **The project beside a long name** - beside an agent name too long for the row, the "<project> ›" breadcrumb keeps its width up to its cap and cuts a longer project name, and the agent name is the one that truncates. The test DOM has no layout, so this is checked on the elements' styling.
- **The name first, the facts together** - the agent's name shows while its checkout is still being read and no fact does; once read, the facts still wait until the caller says it is ready, then show.
- **Switching agents** - after switching from an agent to one whose read has not answered, the first agent's "dirty" is not shown under the second's name; switching back shows the first agent's "dirty" from the first frame, remembered. The test fails when the line keeps the previous agent's facts instead.
- **The pull request** - shown without the agent's name, an agent's branch's pull request shows as "PR #42" with its state "open", the way the project's does.
- **An ended agent with no checkout** - shown without the agent's name, an agent whose checkout is gone shows the branch it recorded and neither "clean" nor "dirty".
- **No size while unmeasured** - when the daemon has not measured the checkout's size, no placeholder appears where the number would go.
- **Nothing to report** - when the daemon has no checkout to report, the line renders nothing.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
- **The chevron comes first** - with a disclosure, the chevron is drawn before the name while the facts are still out; without one, no chevron is drawn.
