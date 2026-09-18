What the tests cover, for the box at the bottom of an agent view:

- **The slot while the agent works** - the empty box offers "Stop agent"; pressing it stops this agent [1], and the "Stopping…" hold releases when the stop lands, so an agent that is resumed gets a working Stop again.
- **The slot once the agent was stopped** - the empty box offers "Resume", which says the stock continuation message to this same agent; a refused Resume shows the daemon's own words instead of pretending to resume; after a Resume that went through, the slot holds a busy Resume until the agent reads as working, with no flicker.
- **No slot control otherwise** - an agent that finished on its own, and one waiting [2] on its question, offer neither Stop nor Resume.
- **A send to a working agent** - the text goes to the daemon as a message for this agent, and the box says it is queued until the agent's turn ends; a refused message shows why and is not reported as queued.
- **A send to an ended agent** - the box says the session can be continued; the send is the same message call, and the shell is told to follow the same agent; a refused resume shows why and the shell is told nothing.
- **What is left out** - no coding agent and model select and no "Run on" pick, since an agent cannot change either.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[2] waiting: how an agent that ended on a question reads: not working, its checkout kept, resumed by the answer or by the user's next message.
