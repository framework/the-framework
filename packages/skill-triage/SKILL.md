---
name: triage
description: Put the tickets whose plan says they are ready on the project's agent queue, unattended; the quick wins, the consensual work, or both.
disable-model-invocation: true
---

Choose work for the agent queue. Nobody will answer you: never ask, decide yourself. You only queue work, you never do it: the only thing you change is the queue. The word after the command is the mode: `quick`, `consensual`, or nothing for both.

1. If the word is any other word, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user saying which and stop.
2. Read every open ticket as listed, and the queue; the listing decides, open no ticket. If either read fails, show an error to the user saying which and why, and stop.
3. Only a planned ticket whose listing gives both an effort and an uncertainty qualifies. A quick win has effort 2 or less and uncertainty 2 or less. Consensual work has uncertainty 3 or less and is not a quick win. Skip a ticket the listing shows locked, in review, waiting, or with its plan outdated, and one with an entry on the queue that holds its file name, `.md` included.
4. Queue the rest one by one, lowest effort first. If a write fails, show an error to the user saying which ticket and why, and stop: the rest wait for the next run.
