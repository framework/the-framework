Status: open
Priority: 8
GitHub: [#1145](https://github.com/gemstack-land/the-framework/issues/1145)

# What is "Log"?

## TLDR

A dashboard element labelled "Log" is not understandable (screenshot in the issue: https://github.com/user-attachments/assets/9196f66f-27e4-49b7-87fd-7824774c0e35). Clarify, rename, or remove it.

## Why it matters

High priority, same family as #1138/#1145-style dogfooding confusions: every label on the dashboard must be self-explanatory to a first-time user — if the maintainer has to ask what it is, users have no chance.

## Status

Renamed, and explained where it is read. The element was the right rail's `Log` tab: it renders
`.the-framework/LOGS.md`, the committed record of every finished session in the project. "Log"
reads as agent output or a console stream, which is the one thing it is not.

- The tab is **History** now.
- Every rail tab (Files, Choices, Views, Browser, Docs, History) explains itself in a one-line
  hover tooltip.
- The panel leads with what it is: finished sessions, newest first, from the committed
  `.the-framework/LOGS.md`, so it survives a fresh clone. Its empty state says "sessions" rather
  than "log entries".

Not removed: the left sidebar's "Recent sessions" reads `.the-framework/runs/*.json`, which is
gitignored and transient. `LOGS.md` is the durable, committed history, and this tab is its only
surface.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1145](https://github.com/gemstack-land/the-framework/issues/1145), created 2026-07-25, label: `priority: high`.

### Original description

I don't understand what this is:

<img width="266" height="146" alt="Image" src="https://github.com/user-attachments/assets/9196f66f-27e4-49b7-87fd-7824774c0e35" />
