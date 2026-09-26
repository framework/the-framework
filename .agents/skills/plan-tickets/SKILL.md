---
name: plan-tickets
description: Queue a plan for the open tickets that have none or whose plan is outdated, unattended; at most ten a run.
disable-model-invocation: true
---

Queue plans for the tickets that need one. Nobody will answer you: never ask, decide yourself. You only queue work, you never do it: write no plan yourself, the only thing you change is the queue.

1. If this project has no ticketing system or no AI queue, show an error to the user saying which and stop.
2. Read every open ticket as listed, and the queue; the listing decides, open no ticket. Below, a ticket's `<name>` is its file without `.md`.
3. A ticket needs a plan when its listing shows none, or shows its plan outdated. Skip a ticket the listing shows locked, in review (it has a pull request) or waiting, and one already on the queue: any entry, in any wording, with its `<name>` anywhere in it. If no ticket is left, say so and stop.
4. A ticket's priority is its own when that is a bare whole number from 0 to 10, else 5. Take at most ten: highest priority first, then oldest date first, then by the listing's file name, `.md` included, compared character by character in code order (`-` before `.`). The rest wait for the next run.
5. Queue them one by one in that order, each as the plain sentence `Create tickets/<name>.plan.md` at the ticket's priority. Not a link: a link would ask for the ticket's work, not its plan. If a write fails, show an error to the user saying which ticket and why, and go to step 6: that ticket and the rest wait for the next run.
6. End by naming each entry you queued with its priority, each ticket that needs a plan but was skipped and why, and how many tickets that need a plan are left for the next run.
