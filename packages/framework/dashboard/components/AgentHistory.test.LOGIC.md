What the tests cover, for the dashboard's left column and its list of agents:

- **A working agent** - reads "running" with a pulsing dot.
- **A settled agent** - a running agent parked on the user reads "waiting", never "running", and nothing pulses.
- **Publishing** - an agent that ended cleanly, armed to push, with no handoff report yet reads "publishing…" with a pulsing dot and never "done"; once the handoff has reported, or when the agent was never armed to push, it reads plain "done".
- **A finished agent is never waiting** - a "done" agent with a stale settled mark reads "done", not "waiting".
- **The starting row is highlighted** - when the page selects an agent whose row has not landed yet, the "starting…" stand-in carries the highlight and the "New agent" button does not.
- **The starting row retires on landing** - the stand-in goes as soon as an agent appears that was not listed when Start was clicked, even one that landed already "failed" without ever being seen running; an agent that was already listed when Start was clicked does not retire it.
- **Where an agent runs** - a relayed agent shows a device glyph named "Runs on <device>"; an agent another machine's daemon started shows a glyph named "Started on <host>", while this daemon's own agents show none; a local agent shows no device glyph.
- **The column on the Overview** - with no project and no agents it still shows "New agent" and "No agents yet."; with pooled recent agents each row names its project, and selecting one jumps into that project and that agent.
- **"New agent"** - with one project it starts in that project; inside a project it starts in that project; with several projects and none selected it opens a picker instead of starting.
- **"Tickets"** - offered with no project selected and inside a project alike, opening the tickets view; it carries the active fill while the tickets view is current and "Overview" does not; it is not offered when the caller has nowhere to route it.
- **Cloud sessions** - a finished web agent reads "in cloud", not "done"; a stopped web agent reads "stopped"; a web agent whose cloud session the bridge reports as parked reads "waiting"; a web agent with a pull request reads "done", one whose adopted work merged reads "merged", and an old one with nothing adopted reads "done"; a web agent shows the cloud glyph and still names "Claude Code" as its coding agent; a local finished agent reads "done" with no cloud glyph.
- **Long titles** - a title that overflows the column shows the full prompt in a tooltip on hover; a title that fits has no tooltip.
- **Project errors in the "Projects" list** - a project the daemon recorded an error for gets a red dot, announced as "Error:", whose hover names the error ("Not syncing with the remote") and the daemon's message; a healthy project keeps its activated dot, announced as "Activated:".
