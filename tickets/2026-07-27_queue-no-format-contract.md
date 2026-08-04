Topics: [bug]
GitHub: [#1280](https://github.com/gemstack-land/the-framework/issues/1280)

# Queue has no format contract: a triage exclusion note became an assignment

## TLDR

Live specimen from the end-to-end drive (same session as #1279): the triage-quick run correctly excluded a deliberately non-consensual ticket from the queue, writing the exclusion as a prose bullet in `TODO_AGENTS.md` — and the queue parser, which treats any link-leading list bullet as an open entry (the #1164 link style), assigned an agent to that very line on the next drain tick. An agent is now working a ticket whose queue entry says it must not be worked. Underlying problem: `TODO_AGENTS.md` is prose agents write freely and the queue reader has no format contract with them, so a note, caveat, or "not queued because" line is indistinguishable from an entry (same fragility class as #1252's call-out on #1243's text-keyed queue merging).

## Why it matters

The queue is the autonomy backbone; if exclusion notes become assignments, triage's judgment gets silently inverted and agents burn tokens on work flagged as not-ready. Fix directions from the issue: (1) give the queue a real contract — entries live only under a known heading (e.g. `## Queue`) or must carry an explicit `- [ ]` checkbox, enforced in the parser and taught in the triage/drain prompts; (2) short-term cheapest — the triage prompt puts exclusions in a section the parser skips (e.g. `## Not queued`), and the drain prompt refuses an entry whose text contradicts working it.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1280](https://github.com/gemstack-land/the-framework/issues/1280), created 2026-07-27, label: `bug`.

### Original description

Live specimen from the end-to-end drive (scratch repo, real daemon, real agents; same session as #1279).

The triage-quick run was given one deliberately non-consensual ticket (a SQLite migration with open questions) to see whether it would stay out of the queue. The agent excluded it correctly, in prose, inside TODO_AGENTS.md:

```md
- [Migrate storage to SQLite](tickets/2026-07-27_sqlite-storage.md) — deliberately excluded: the
  ticket carries open questions (driver choice, migration of existing `notes.json`, whether to add a
  `--db` flag). Needs a spike or a plan before it can be queued.
```

The queue parser treats any link-leading list bullet as an open entry (the #1164 link style), so the next drain tick assigned an agent to that line. Observed in the daemon log:

```
[framework] auto PM: draining the queue entry "[Migrate storage to SQLite](tickets/2026-07-27_sqlite-storage.md) — deliberately…"
```

An agent is now working a ticket whose queue entry says it must not be worked. The triage did the right thing; the file format turned its exclusion note into an assignment.

Underlying problem: TODO_AGENTS.md is a prose file that agents write freely, and the queue reader has no format contract with them. Anything shaped like a bullet becomes work, so a note, a caveat, or a "not queued because" line is indistinguishable from an entry. This is the same fragility class #1252 called out about #1243's text-keyed queue merging.

Fix directions:

1. Give the queue a real contract: entries live only under a known heading (e.g. `## Queue`), or must carry an explicit checkbox `- [ ]`; everything else in the file is prose the parser ignores. Enforce it in the parser, teach it in the triage/drain prompts.
2. Short term, cheapest: the triage prompt tells the agent to put exclusions in a section the parser skips (e.g. `## Not queued`), and the drain prompt to refuse an entry whose text contradicts working it.
