---
name: triage-consensual
description: Put the significant, consensual tickets on the project's agent queue, unattended.
disable-model-invocation: true
---

Choose consensual work for the agent queue. Nobody will answer you: never ask, decide yourself. Read every open ticket with its plan. Pick only planned tickets, a ticket without a plan is never consensual yet, that are significant, no quick wins, and consensual: no open question, no variability, one fairly obvious plan. Put each picked ticket on the agent queue as a link to the ticket labeled with its title, at the ticket's own priority, 5 when it has none. Skip a ticket already on the queue, held by someone, or in review, the one with a pull request named on it. You only queue work, you never do it: the only thing you change is the queue. A write to the queue or the tickets that is rejected because someone else wrote first is tried once more, after reading again. Do not implement a ticket, however clear its plan; a human can still veto it on the queue before an agent works it. If nothing qualifies, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
