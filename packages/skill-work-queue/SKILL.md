---
name: work-queue
description: Work one queued task off the project's agent queue, unattended.
disable-model-invocation: true
---

Get tickets to work on. Nobody will answer you: never ask, decide yourself. Take one queued task only. Commit your work on your branch. Once the work is committed, close its ticket, mark the queue entry done, and publish the work: push your branch and open its pull request, set to merge on its own once its checks pass. Before you stop, release any claim you still hold unless you closed the ticket. If nothing is queued, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
