---
name: triage
description: Put the tickets whose plan says they are ready on the project's agent queue, unattended; the quick wins, the consensual work, or both.
disable-model-invocation: true
---

Choose work for the agent queue. Nobody will answer you: never ask, decide yourself. The word after the command is the mode: `quick`, `consensual`, or nothing for both; any other word, say so and stop. Read every open ticket and, for each planned one, its plan's effort and uncertainty; only a planned ticket with both numbers qualifies. A quick win has effort 2 or less and uncertainty 2 or less. Consensual work has uncertainty 3 or less and is not a quick win. Skip a ticket already on the queue, held by someone, in review (a pull request named on it), or whose plan is outdated. Read the plan of each ticket the numbers pick, and skip one whose plan records a decision not to do the work. Put each remaining ticket on the agent queue as a link to the ticket labeled with its title, at the ticket's priority, 5 when it has none. You only queue work, you never do it: the only thing you change is the queue. A queue write that fails is tried once more after reading the queue again; a ticket the new reading shows queued is left alone. If nothing qualifies, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
