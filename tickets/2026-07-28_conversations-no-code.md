Priority: 3
Topics: [the-framework]
GitHub: [#1345](https://github.com/gemstack-land/the-framework/issues/1345)

# conversations/ should need no code at all

## TLDR

`conversations.ts` is ~200 lines that format, append, escape and gitignore the conversation files. None of it should exist: telling an agent "record the human conversations in `.the-framework/conversations/`" should be enough — writing a markdown file is something the agent can already do. Preconditions: nothing parses the file programmatically (#1343) and it's a record for humans, not a data structure (#1344). Then the code goes and an instruction replaces it.

## Why it matters

Same principle as the prompts directory, where nothing agent-facing is written in TypeScript any more — this extends it from prompts to mechanisms. We give AI capabilities, we don't babysit it.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1345](https://github.com/gemstack-land/the-framework/issues/1345), created 2026-07-28, labels: `priority: low`, `the-framework ♻️`, 0 comments. Blocked by #1343 and #1344.
