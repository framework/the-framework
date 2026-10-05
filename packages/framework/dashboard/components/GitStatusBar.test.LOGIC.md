What the tests cover, for the line that names an agent [2] at the top of its page:

- **The name and the size, nothing else** - given the agent's name and a checkout [1] that has a branch and a pull request, the line's whole text is the name and the size ("5 MB"), the same for a dirty checkout and a clean one: no "clean", no "dirty", no branch, no pull request. With the checkout gone, or not read yet, it is the name alone.
- **Never a branch** - a line given no name shows nothing: no branch, no "no branch", and no pull request link.
- **The size lands with the checkout** - the line shows no size while the caller's read has not answered, and the size once handed the checkout.
- **The project beside a long name** - beside an agent name too long for the row, the "<project> ›" breadcrumb keeps its width up to its cap and cuts a longer project name, and the agent name is the one that truncates. The test DOM has no layout, so this is checked on the elements' styling.
- **The "›" separator** - a project and an agent named by a command read "<project>›" then the command, never a doubled slash.
- **The name first, the size after** - handed a measured checkout, the line shows the project and the name alone until the caller says it is ready, then the size too.
- **The chevron comes first** - with a disclosure, the chevron is drawn before the name while the caller is not ready, and the name is not a button yet; once ready it is a collapsed disclosure button. Without a disclosure, no chevron is drawn.
- **No size while unmeasured** - when the daemon has not measured the checkout's size, the line is the agent's name alone: no placeholder appears where the number would go.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
