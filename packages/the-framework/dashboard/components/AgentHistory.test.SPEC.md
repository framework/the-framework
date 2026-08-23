What the tests cover:

- **What a row's status says** - a working agent reads "running" and animates; one parked on the user reads "waiting" with the animation stopped; an agent that ended clean with a handoff still to come reads "publishing…" and animates, and reads plain "done" once the handoff has reported or when none was armed; a finished agent is never relabelled "waiting".
- **The starting placeholder** - it carries the highlight while the user follows an agent whose row has not arrived yet; it retires as soon as any agent lands that was not in the list when Start was pressed, even one that failed too fast to ever be seen running; and an agent that was already in the list does not count as that handover.
- **Where the agent runs** - an agent on another device shows a glyph naming that device, while a local one shows none; an agent handed to a cloud session reads "in cloud" instead of "done" (because the cloud side is still working), shows a cloud glyph, and still names its driver — but one stopped early reads plainly "stopped", since nothing is working anywhere.
- **Scope of the list** - with no project selected the rail still shows New agent and says "No agents yet."; the Overview pools every project's agents, naming each row's project, and selecting one jumps into that project's agent.
- **New agent** - with one project it starts there; inside a project it starts another agent there; with several projects and none selected it opens a picker instead of starting immediately.
- **Tickets** - offered both inside a project and on the Overview, opens the ticket view, carries the active marker while it is the current view (with Overview not also claiming it), and is not offered at all when there is nowhere to route it.
- **Long task titles** - a title too wide for the rail shows in full on hover, while one that fits has no hover behaviour at all.
- **Project health** - a project the daemon recorded an error for shows a red dot naming the error on hover, and a healthy one keeps the activated dot.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
