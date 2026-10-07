What the tests cover, for the action bar at the top of an agent's [1] page:

- **No status word, no clean or dirty** - for a running, a finished, a failed, a stopped and a waiting agent, each with a checkout that holds uncommitted changes, a branch and a pull request, the bar's whole text is the agent's name as the button of the agent's menu, the chip "This machine · <project>" and the "⋮" of the project's menu: no word for the agent's state, no failure reason, no "dirty", no branch, no pull request, no size.
- **The order of the row** - the name comes first, then the chip, then the project's menu; the chip reads "<where the agent runs> · <project>" with the same text on hover, is cut at a cap and is the part a narrow bar leaves out.
- **The chip with no project** - it says where the agent runs alone, and "This machine" when the caller does not say where.
- **The error count stays** - a running, a finished and a stopped agent that reported an error each show "1 error" before the project's menu.
- **The size goes to the agent's menu** - the checkout's size ("5 MB") is handed to the agent's menu and is not in the bar's text; until the caller says the agent's facts are ready, no size is handed over and no error count shows, and the bar's whole text is the name, the chip and the project's menu.
- **A name not known yet** - the agent's menu is still there, handed no name.
- **The details under the bar** - given a toggle, the agent's menu is told the detail is hidden, or shown once the caller says it is open, and its toggle calls the caller's once; given no toggle, the menu is told of no detail.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
