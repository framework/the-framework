Drains the project's task queue one entry per turn until it is empty, and owns the queue plumbing other features lean on — the queue itself living on the data branch, with the framework as its writer.

## TLDR

- The framework drives: read the queue's first open entry fresh off the data branch, gate ("start the next item?" — an agent nobody is watching takes the recommended answer and carries on), prompt the agent to complete exactly that entry, then check it off on the data branch itself — the queue is not the agent's file to edit, and an entry someone else already retired is simply found done.
- Safe to leave unattended: a hard item cap, the agent's stop and budget signal, and a write guard — a check-off that cannot land stops the loop rather than re-serving finished work.
- A backlog turn is a full turn: ask-gates and signals are honored there too, with ready-for-merge fired once across the whole backlog.
- An entry queued with a priority lands in its numbered section, not at the end — the queue drains front to back, so placement is priority. Every queue write, the paused agent's resume note included, goes through the data branch's write funnel.
- An agent's own session TODO file (a checkout file, not the queue) with open entries withholds auto-merge — a temporary belt under the agent's own ready signal.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
