Drains the project's task queue one entry per turn until it is empty, and owns the queue plumbing other features lean on — the queue itself living on the data branch, with the framework as its writer.

## User Stories

- The user queues confirmed work, and an unattended agent drains it one entry per turn until the queue is empty.
- The user watching an agent is asked before each queue entry and can stop the loop.
- The user queues an entry with a priority, and it is worked in rank order rather than arrival order.

## Flows

- The framework, not the agent, drives the drain: each turn it reads the queue's first open entry fresh off the data branch, asks "start the next item?", prompts the agent to complete exactly that entry, then checks it off on the data branch itself.
- The user watching answers that per-item gate and can stop the loop there; an agent nobody is watching takes the recommended answer and carries on.
- The queue is not the agent's file to edit — the framework writes every check-off, and an entry someone else already retired is simply found done.
- Safe to leave unattended: a hard item cap, the agent's stop and budget signal, and a write guard — a check-off that cannot land stops the loop rather than re-serving finished work.
- A backlog turn is a full turn: ask-gates and signals are honored there too, with ready-for-merge fired once across the whole backlog.
- An entry the user queues with a priority lands in its numbered section, not at the end of the file. Every queue write, the paused agent's resume note included, goes through the data branch's write funnel.
- An agent's own session TODO file (a checkout file, not the queue) with open entries withholds auto-merge — a temporary belt under the agent's own ready signal.

## Rationales

- The queue drains front to back, so placement is priority: an entry appended at the end would be worked last, behind everything already queued.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
