The backlog loop: drain `TODO_AGENTS.md` one entry per agent turn until it is empty, plus priority-aware queue insertion.

## TLDR

- Cycle: read the next open entry → gate ("start the next item?") when someone can answer → prompt the agent to complete exactly that one entry and check it off → repeat.
- Autopilot auto-accepts the per-item gate so the whole backlog drains unattended; autopilot off pauses before each entry.

## Decisions

- Three independent bounds make it safe unattended: the run's abort/budget signal, a hard item cap, and a stall detector (two consecutive items that leave the next entry untouched).
- One turn-signal emitter serves the whole loop, so ready-for-merge fires once across every item, not once per item.

## Facts

- Priority insertion rules: join an existing `## Priority N` section at its end; else create the section before the first *lower* one; with no priority sections, insert above the first heading of any kind.
- Entry parsing skips headings and prose, so a priority-sorted file drains in priority order with no parser support.
- Session-scoped TODO files are retired; a leftover one is ignored.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
