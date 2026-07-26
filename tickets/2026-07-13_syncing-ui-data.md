Status: open
Topics: [the-framework]
GitHub: [#454](https://github.com/gemstack-land/the-framework/issues/454)

# Syncing UI<->data

## TLDR

How the UI stays in sync with the data it shows. Approach: the filesystem (all Git repos' `.the-framework/*`) is the single source of truth. The MVP shape is already live: lists/rails fetch over Telefunc RPCs on mount (most poll every 4–5s), and the main run view is a Telefunc Channel (`onEvents`) pushing one FrameworkEvent per new `.the-framework/events.jsonl` line. The open piece: live auto-sync of the lists via `fs.watch` on each repo's `.the-framework/*` pushed over Telefunc (watch→channel design assigned to @nitedani).

## Why it matters

This is a fundamental architecture question for the whole dashboard: Git-as-source-of-truth keeps state out of a separate database (see the Database ticket / #313), and Vite proves filesystem watching at this scale is reliable. The remaining gap (poll/F5 for lists) is the difference between "fresh enough" and instant.

## Source

Imported from GitHub issue [gemstack-land/the-framework#454](https://github.com/gemstack-land/the-framework/issues/454), created 2026-07-13, label: `the-framework ♻️`, 1 comment.

### Original description

There seem to be fundamental question about how the UI should be synced with the data it shows.

So far, I think the best approach is to treat the filesystem (more precisely speaking, all the Git repos) as the single source-of-truth.

The potential downside is that we'll need filesystem watchers. So far I think it can work reliably though: Vite shows that watching all the files of a project works, and we'll only need to watch The Framework's `.the-framework/*` data (of all Git repos).

The follow up question is about Telefunc. How can we use Telefunc to automatically sync the UI with `.the-framework/*` data? @nitedani Ideas?

@suleimansh In then meantime, for the MVP, I guess it's enough if the UI requests the data at load time (no syncing, user has to F5 the page to get fresh data), while the main view is synced via Telefunc Stream.

See also:
- https://github.com/gemstack-land/gemstack/issues/313

### Notes from the GitHub thread

- Verified live: load-time Telefunc RPCs on mount for projects (`onProjects`), run history (`onRuns`), docs (`onDocs`), project log (`onProjectLog`), queue (`onQueue`), overview (`onOverview`) — most polling every 4–5s; main view synced via the `onEvents` Telefunc Channel over `events.jsonl`. Open: `fs.watch` → Telefunc push so sidebars/rails update the instant a file changes.
