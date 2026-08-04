Priority: 5
Topics: [the-framework]
GitHub: [#1344](https://github.com/gemstack-land/the-framework/issues/1344)

# conversations/ should record only humans

## TLDR

`conversations/<runId>.md` currently holds both sides (`role` is `user | agent`). With many autonomous agents the file fills with agent output and finding what a human actually said gets hard; the agent's side already lives in `events.jsonl`. Changes: narrow `ConversationRole` to the human side, drop the two `recordMessage('agent', ...)` calls in `await-gate.ts`, update `conversations.spec.md`.

## Why it matters

Cleaner separation of the human record from agent logs — and a precondition for #1345 (no code at all for conversations/). Blocked by #1343: the discord bot reads agent replies out of this file today, so doing this first would silently stop it mirroring.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1344](https://github.com/gemstack-land/the-framework/issues/1344), created 2026-07-28, labels: `priority: medium`, `the-framework ♻️`, 0 comments.
