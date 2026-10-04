What the tests cover, for the action bar at the top of an agent's [1] page:

- **A failed agent says "failed"** - an agent whose end failed with a reason shows the word "failed" in the bar, and the reason is not written in the bar (it is the word's hover).
- **What the page knows first decides the word** - an agent that ended clean shows "finished"; told by the page that the agent is starting, the bar shows "building…"; told that a turn was just seen ending, "saving…".
- **The word has a width** - the status word's element has a minimum width of 4.75rem.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
