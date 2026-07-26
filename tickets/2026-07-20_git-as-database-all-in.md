Status: open
GitHub: [#857](https://github.com/gemstack-land/the-framework/issues/857)

# Git as database — all in

## TLDR

Go all-in on Git as the database: save as much as possible inside the Git repo — for example the conversations (#680) and even the list of sessions. Verbose session logs can stay with the AI model provider for now.

## Why it matters

This doubles down on the git-as-data stance (#313 "the `.the-framework/` directory *is* the database", #605 "no database and no real server needed"): state travels with the repo, is versioned and reviewable for free, and keeps the 100%-local/open-source positioning intact. Drawing the line at provider-hosted verbose session logs keeps repos lean.

## Source

Imported from GitHub issue [gemstack-land/the-framework#857](https://github.com/gemstack-land/the-framework/issues/857), created 2026-07-20, no labels.

### Original description

After some thoughts, I think we should save as much as possible inside the Git repo.

For example the conversations:
- https://github.com/gemstack-land/gemstack/issues/680

Even the list of sessions. (Although I think we don't have to save the verbose session log for now, we can leave it be saved by the AI model provider).
