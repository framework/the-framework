---
name: plan-tickets
description: Queue a plan for the open tickets that have none or whose plan is outdated, unattended; at most ten a run.
disable-model-invocation: true
---

Queue plans for the tickets that need one. Nobody will answer you: never ask, decide yourself. Read every open ticket as listed; the listing decides, open no ticket. Below, a ticket's `<name>` is its file without `.md`. A ticket needs a plan when its listing shows none, or its plan is outdated. Skip a ticket its listing shows locked, or with a pull request (in review), or already on the queue (an entry with its `<name>` anywhere in it). A ticket's priority is its own when that is a bare whole number from 0 to 10, else 5. Queue at most ten, one by one, highest priority first, then oldest date first, then by file name A to Z; the rest wait for the next run. Each goes on the queue as the plain sentence `Create tickets/<name>.plan.md`, not a link, at the ticket's priority. You only queue work, you never do it: write no plan yourself, the only thing you change is the queue. A queue write that fails is tried once more after reading the queue again, a ticket the new reading shows queued left alone; failing again, say so and stop the run. If no ticket needs a plan, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
