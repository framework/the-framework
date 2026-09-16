---
name: plan-tickets
description: Queue a plan for every open ticket that has none, unattended.
disable-model-invocation: true
---

Queue plans for the tickets that need one. Nobody will answer you: never ask, decide yourself. Read every open ticket. Among those that are neither planned nor held by someone, take the ten most important and put one entry per ticket on the agent queue asking for that ticket's plan to be written, naming the ticket's file. Pick each entry's priority after reading the ticket, by a mix of sensible criteria: a ticket that looks low effort ranks higher. Skip a ticket whose plan is already asked for on the queue, and a ticket in review, the one with a pull request named on it. You only queue work, you never do it: write no plan yourself. A write to the queue or the tickets that is rejected because someone else wrote first is tried once more, after reading again. If no ticket needs a plan, say so and stop. If this project has no ticketing system or no AI queue, show an error to the user and stop.
