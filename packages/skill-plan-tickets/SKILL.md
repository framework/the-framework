---
name: plan-tickets
description: Queue a plan for the open tickets that have none or whose plan is outdated, unattended; at most ten a run.
disable-model-invocation: true
---

Queue plans for the tickets that need one. Nobody will answer you: never ask, decide yourself. Read every open ticket as listed; the listing decides, open no ticket. A ticket needs a plan when its listing shows none, or its plan is outdated. Skip a ticket held by someone, in review (a pull request named on it), or already on the queue (an entry naming the ticket's file, its name without `.md` anywhere in the entry). A ticket's priority is its own, 5 when it has none or it is not a number from 0 to 10. Queue at most ten, one by one, highest priority first, oldest date first within a priority; the rest wait for the next run. Each goes on the queue as the plain sentence `Create tickets/<name>.plan.md`, not a link, at the ticket's priority. You only queue work, you never do it: write no plan yourself, the only thing you change is the queue. A queue write that fails is tried once more after reading the queue again, a ticket the new reading shows queued left alone; failing again, say so and stop the run. If no ticket needs a plan, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
