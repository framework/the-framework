priority: low
topics: [bug]

# `ticketing_format.md` not respected?

## TLDR

The ticket files previously generated under `tickets/` on `main` didn't respect the filename format specified in `ticketing_format.md` (the `tickets/<DATE>_<SLUG>[.spike].md` convention). Low priority, post-MVP.

## Why it matters

The ticketing format is a contract between agents: dashboards (Hot tickets), the queue promotion flow, and future imports all parse these filenames. Whatever generates tickets — presets, spikes, imports — must be held to the spec, or the tooling on top of it degrades silently. (The 2026-07-25 GitHub import was done strictly to the spec.)

## Source

Imported from GitHub issue [gemstack-land/the-framework#1162](https://github.com/gemstack-land/the-framework/issues/1162), created 2026-07-25, labels: `bug`, `priority: low`.

### Original description

Looking at https://github.com/gemstack-land/the-framework/tree/main/tickets, seems like the filename format wasn't respected:
https://github.com/gemstack-land/gemstack/blob/dc7d79c3f4d0afef5416520fb499fdd69cdb9558/packages/the-framework/prompts/ticketing_format.md?plain=1#L25-L25

Low-prio, post-MVP.
