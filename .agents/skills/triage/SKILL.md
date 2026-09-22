---
name: triage
description: Put the tickets whose plan says they are ready on the project's agent queue, unattended; the quick wins, the consensual work, or both.
disable-model-invocation: true
---

Choose work for the agent queue. Nobody will answer you: never ask, decide yourself. The word after the command is the mode: `quick`, `consensual`, or nothing for both. Read every open ticket with its plan's effort and uncertainty; only a planned ticket qualifies. A quick win has effort 2 or less and uncertainty 2 or less. Consensual work has uncertainty 3 or less and is not a quick win. Skip a ticket already on the queue, held by someone, in review (a pull request named on it), or whose plan records a decision not to do the work. Put each picked ticket on the agent queue as a link to the ticket labeled with its title: a quick win one above the ticket's priority (6 when it has none, never above 10), so it is worked before equal work; consensual work at the ticket's priority, 5 when it has none. You only queue work, you never do it: the only thing you change is the queue. A write to the queue rejected because someone else wrote first is tried once more after reading again; a ticket the new reading shows queued is left alone. If nothing qualifies, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
