What the tests cover:

- **The slot control** - a live agent offers Stop, which stops that agent and then stays "Stopping…" until it actually ends, releasing again when the same agent is resumed; a stopped agent with a session id offers Resume, which sends the stock resume message as a continuation of that same agent and takes the user to it, holds a busy Resume until the resumed agent reads live (never flickering back through Stop), and surfaces a refusal instead of pretending to have resumed; an agent that finished on its own offers neither, and a stopped agent that never reported a session id cannot offer Resume.
- **While the agent runs** - an ordinary send is queued for the open agent, never starting anything new; a preset that starts its own agent does so instead of messaging the running one, is not attributed to it, and the view follows the agent it just started; a refused start shows the reason and does not navigate.
- **Once the agent has ended** - the box says the agent can be resumed rather than being a dead end; a send starts a continuation seeded with the finished agent's session id, written into the same agent, and never tries to message a process that is gone; the continuation runs on the driver that agent used rather than the user's current preference, and re-chooses neither driver nor model; a refused start is surfaced instead of navigating.
- **Ended with no session id** - the box stays and its placeholder says the next message starts a new agent (said once, only there); sending starts a fresh agent with the text and resumes nothing.
- **Options** - the send options are offered only once the agent has ended, since a running agent has nothing adjustable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
