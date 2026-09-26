---
name: triage
description: Put the tickets whose plan says they are ready on the project's agent queue, unattended; the quick wins, the consensual work, or both.
disable-model-invocation: true
---

Choose work for the agent queue. Nobody will answer you: never ask, decide yourself. You only queue work, you never do it: the only thing you change is the queue. The word after the command is the mode: `quick`, `consensual`, or nothing for both.

1. If the word is any other word, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user saying which and stop.
2. Read every open ticket as listed, and the queue; the listing decides, open no ticket. Below, a ticket's `<file>` is its file name as listed, `.md` included.
3. Only a planned ticket whose listing gives both an effort and an uncertainty qualifies. A quick win has effort 2 or less and uncertainty 2 or less. Consensual work has uncertainty 3 or less and is not a quick win. Skip a ticket the listing shows locked, in review (it has a pull request), waiting, or with its plan outdated, and one already on the queue: any entry, in any wording, with its `<file>` anywhere in it. If no ticket is left, say so and stop.
4. A ticket's priority is its own when that is a bare whole number from 0 to 10, else 5. Order the tickets lowest effort first, then by `<file>`, compared character by character in code order (`-` before `.`); with both modes, the two kinds as one list.
5. Queue them one by one in that order, each as the link `[<title>](tickets/<file>)` at the ticket's priority. If a write fails, show an error to the user saying which ticket and why, and go to step 6: that ticket and the rest wait for the next run.
6. End by naming each entry you queued with its priority and kind, each ticket that met a mode's numbers but was skipped, and why, and each one a failed write left for the next run.
