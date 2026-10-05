What the tests cover, for the line of git facts about the checkout [1] in play:

- **Whose checkout** - on the project home the project's own checkout is read, showing its branch and "clean", and no agent's [2] checkout is asked for; with an agent selected that agent's checkout is read instead, showing its size on disk ("5 MB"), and the project's is not asked for.
- **An agent's page** - given the agent's name and a checkout that has a branch and a pull request, the line's whole text is the name and the size, the same for a dirty checkout and a clean one: no "clean", no "dirty", no branch, no pull request. With the checkout gone, or not read yet, it is the name alone.
- **Never a branch on an agent's line** - an agent's line given no name shows nothing: no branch, and no "no branch".
- **The project's line says clean or dirty** - the project's line reads its branch then "dirty" for a checkout with uncommitted changes, read by the line itself, and its branch then "clean" for a clean checkout handed in by the caller.
- **Given the checkout, it reads nothing** - handed the checkout by its caller, the line shows no size while the caller's read has not answered, shows the size once handed the checkout, and asks the daemon about neither the agent's checkout nor the project's.
- **The project beside a long name** - beside an agent name too long for the row, the "<project> ›" breadcrumb keeps its width up to its cap and cuts a longer project name, and the agent name is the one that truncates. The test DOM has no layout, so this is checked on the elements' styling.
- **The name first, the size after** - the agent's name shows while its checkout is still being read and the size does not; once read, the size still waits until the caller says it is ready, then shows.
- **The chevron comes first** - with a disclosure, the chevron is drawn before the name while the facts are still out; without one, no chevron is drawn.
- **Switching agents** - after switching from an agent to one whose read has not answered, the first agent's size is not shown under the second's name; switching back shows the first agent's size from the first frame, remembered. The test fails when the line keeps the previous agent's facts instead.
- **The pull request** - the project's branch's pull request shows as "PR #42" with its state "open"; an agent's line links none, with the agent's name or without it.
- **No size while unmeasured** - when the daemon has not measured the checkout's size, the line is the agent's name alone: no placeholder appears where the number would go.
- **The project's line waits for its read** - the project's own line shows nothing until its read answers.
- **Nothing to report** - when the daemon has no checkout to report, the line renders nothing.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
