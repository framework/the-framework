Drains the session's own TODO backlog one entry per turn until it is empty, and owns the queue-file plumbing other features lean on.

## TLDR

- The agent writes its backlog; the framework only drives: read the first open entry, gate ("start the next item?" — a session nobody is watching takes the recommended answer and carries on), prompt the agent to complete exactly that entry and check it off, repeat until empty.
- Safe to leave unattended: a hard item cap, the run's stop and budget signal, and a stall check — two turns that leave the next entry untouched stop the loop, while follow-ups the work itself appended do not count as stalls.
- A backlog turn is a full turn: ask-gates and signals are honored there too, with ready-for-merge fired once across the whole backlog.
- An entry queued with a priority lands in its numbered section, not at the end — the queue drains front to back, so placement is priority.
- A paused run leaves a "resume me" entry for a later run to pick up, and a session's own TODO file with open entries withholds auto-merge — a temporary belt under the agent's own ready signal.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
