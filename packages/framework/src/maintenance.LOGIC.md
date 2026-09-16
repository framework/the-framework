The maintenance sweep's bookkeeping. Per project, a small state file (`.the-framework/maintenance.json`) records the last commit a maintenance review covered and when. A commit-delta assessment is implemented here: baseline a first-seen project, skip an unchanged one, review only new commits, and record progress only when the review succeeds. The commit-delta sweep has no caller in the product today.

## Context

**User story**: a project's code is reviewed for maintainability by an agent [1], and only the commits added since the last review are looked at.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The state a project keeps** - `.the-framework/maintenance.json` holds the last reviewed commit and when it was reviewed; a missing or malformed file reads as "never", and a partial update leaves the other field alone.
- **Assessing a project for a commit-delta review** - a first-seen project is baselined at its current commit, an unchanged one is skipped, new commits mean a review, a directory that is not a repository is an error, and a reviewed commit git no longer knows means a re-review.
- **Running the commit-delta sweep** - baselines record without running anything, reviews run a maintenance agent and record the commit only on success so a failure is retried next time, and a per-sweep cap leaves the rest pending.

## Business logic

### The state a project keeps

#### Context

See `## Context`.

#### Business logic

Each project's maintenance state is one file, `.the-framework/maintenance.json`, with up to two fields: the full id of the last commit a commit-delta review covered, and the time of that review.

Reading is forgiving: a file that is missing, unreadable or not valid JSON reads as an empty state (no prior review), and only the two known fields are kept, each only when it holds text. Writing creates `.the-framework/` if needed and replaces the file. A partial record merges the fields it mentions into what the file already holds; a partial record on a project with no file yet creates the file.

### Assessing a project for a commit-delta review

#### Context

See `## Context`.

#### Business logic

Assessing one project resolves its current commit, reads its state, and decides one of four actions, never throwing:

- `error` when the directory is not a git repository or has no commits ("not a git repo, or it has no commits").
- `baseline` when no reviewed commit is recorded: the current commit will be recorded without reviewing the history before it.
- `skip` when the reviewed commit is the current commit, or when no commit has been added since it.
- `review` when commits have been added since the reviewed commit, with their count; and also when git no longer knows the reviewed commit (history was rewritten), with the note "reviewed commit not found (history changed); re-reviewing".

Every registered project is assessed the same way, and each assessment carries the project's registry id.

### Running the commit-delta sweep

#### Context

See `## Context`.

#### Business logic

Over the assessed projects, in order: a `skip` is counted and nothing runs; an `error` is counted as failed and reported ("✗ <path>: <note>"); a `baseline` records the current commit and the time, runs nothing, and is reported ("◆ baselined <path> at <short commit id>"). A `review` runs the maintenance agent [1] the caller supplies on the project ("▶ maintaining <path> (N new commits)…"); on success the current commit and the time are recorded ("✓ <path> reviewed"); on failure nothing is recorded ("✗ <path> maintenance session failed; will retry next sweep"), so the same commits are reviewed again next time. A caller may cap how many projects are reviewed in one sweep; baselines and skips do not count against the cap, and reviews past it are counted as pending. The sweep returns the tally: reviewed, baselined, skipped, failed, pending.
