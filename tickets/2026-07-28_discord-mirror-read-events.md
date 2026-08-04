Priority: 5
Topics: [the-framework]
GitHub: [#1343](https://github.com/gemstack-land/the-framework/issues/1343)

# Discord reply mirror should read events.jsonl, not conversations/

## TLDR

The discord bot mirrors agent replies by polling `.the-framework/conversations/<runId>.md` and diffing it (`discord/reply-mirror.ts`). That makes the conversation record a data pipe, which blocks making `conversations/` human-only (#1344) and deleting its parsing code (#1345). `events.jsonl` already carries every agent reply as a `driver` `text` event, and the mirror already resolves the run's checkout — read from there instead.

## Why it matters

Worth doing on its own — the bot shouldn't depend on a file that exists for humans to read — and it unblocks the #1344/#1345 chain.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1343](https://github.com/gemstack-land/the-framework/issues/1343), created 2026-07-28, labels: `priority: medium`, `the-framework ♻️`, 0 comments.
