What the tests cover:

- **Nothing to show, nothing rendered** - with no open question there is no section and no heading.
- **A parked agent's question** - the card shows the question, the agent's session name and its project under the heading "Waiting on you · 1"; picking an option posts that pick against the question's project, gate and agent, as the user.
- **Several projects side by side** - questions from different projects render together, each answerable against its own agent.
- **Into the agent** - the card header opens the agent the question belongs to, project and all.
- **Labeling an unnamed agent** - an agent with no session name is labeled by the first line of its intent.
- **Never a countdown** - no "Auto accept in …" runs here, even with autopilot on.
- **The jump list** - absent with one question; with several, one row per question labeled by agent, and clicking a row scrolls its card into view.
- **Answering collapses in place** - after a pick the live options are gone, the card is a single line with "Expand", the title stays visible and the heading count drops to 0; "Expand" shows the options with the pick marked and "Open session →" still opens the agent; "Collapse" hides them again.
- **A failed post** - the failure's message is shown, the gate stays open and the heading still counts it.
