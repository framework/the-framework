---
name: triage
description: Put the tickets whose plan says they are ready on the project's agent queue, unattended; the quick wins, the consensual work, or both.
disable-model-invocation: true
---

Choose work for the agent queue. Nobody will answer you: never ask, decide yourself. The word after the command is the mode: `quick`, `consensual`, or nothing for both; any other word, say so and stop. Read every open ticket as listed; only a planned ticket whose listing gives both an effort and an uncertainty qualifies. A quick win has effort 2 or less and uncertainty 2 or less. Consensual work has uncertainty 3 or less and is not a quick win. Skip a ticket already on the queue (an entry linking to it), held by someone, in review (a pull request named on it), or whose plan is outdated. Queue each remaining ticket, one by one, lowest effort first, as a link to the ticket labeled with its title, at the ticket's priority, 5 when it has none or it is not a number from 0 to 10. You only queue work, you never do it: the only thing you change is the queue. A queue write that fails is tried once more after reading the queue again, a ticket the new reading shows queued left alone; failing again, say so and stop the run. If nothing qualifies, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
