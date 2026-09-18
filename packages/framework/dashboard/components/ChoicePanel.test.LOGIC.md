What the tests cover, for the "Your call" card of a gate [1]:

- **An accepted pick** - clicking an option sends that option's id for the gate, addressed at the agent [2] that asked; the card then says "Choice sent", the surface is told what was picked, and the options are disabled until the agent goes on.
- **A refused pick** - when the daemon refuses ("this project has no resume hook"), the card shows that reason as an alert, shows no "Choice sent" line, tells the surface nothing, and the options stay enabled so the user can answer again.

## Glossary

[1] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, and the answer resumes it.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
