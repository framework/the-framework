---
name: triage-quick
description: Put the quick-win tickets on the project's agent queue, unattended.
disable-model-invocation: true
---

Choose quick wins for the agent queue. Nobody will answer you: never ask, decide yourself. Read every open ticket with its plan's effort and uncertainty. Pick the tickets whose plan shows a quick win: a low effort and no uncertainty. Put each picked ticket on the agent queue as a link to the ticket labeled with its title, with a sensible priority, and consider bumping the lowest-effort tickets so agents work them first. Skip a ticket already on the queue or held by someone. You only queue work, you never do it: the only thing you change is the queue. Do not implement a ticket, however small its plan; a human can still veto it on the queue before an agent works it. If nothing qualifies, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
