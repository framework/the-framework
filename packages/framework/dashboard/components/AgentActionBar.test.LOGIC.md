What the tests cover, for the action bar at the top of an agent's [1] page:

- **No status word, no clean or dirty** - for a running, a finished, a failed, a stopped and a waiting agent, each with a checkout that holds uncommitted changes, a branch and a pull request, the bar's whole text is the "<project> ›" breadcrumb, the agent's name, the checkout's size ("5 MB") and the "⋮" menu: no word for the agent's state, no failure reason, no "dirty", no branch, no pull request.
- **The error count stays** - a running, a finished and a stopped agent that reported an error each show "1 error" before the menu.
- **Not ready** - until the caller says the agent's facts are ready, the bar's whole text is the agent's name and the menu.
- **The disclosure stays** - given a toggle, the agent's name is a collapsed disclosure button, and clicking it calls the toggle once.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
