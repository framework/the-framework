Tells the agent where The Framework's own data lives and how to touch it: tickets, the agent queue and the agent archives sit on the data branch `tf-data`, are read off that branch without ever checking it out, and are written as commits pushed straight to it rather than riding the agent's pull request.

## Business logic — TL;DR

- **The data is not in the checkout** - `tickets/**.md` (plans and locks included), `TODO_AGENTS.md` and the agent archives exist only on `tf-data`, so the agent reads them off the branch after fetching, falling back to the remote copy when there is no local branch.
- **Writes go straight to the data branch** - only when the agent's instructions say to edit tickets or the queue, and then as a commit on `tf-data` pushed immediately, rebasing and retrying if the push is rejected.
- **Data never mixes with code** - the agent never switches its checkout to `tf-data` and never places these files on its own agent branch, so a data change is published on its own instead of arriving inside the pull request.

## Business logic

### The data is not in the checkout

#### User story

The user wants the project's default branch to stay 100% code. Everything The Framework writes about the project — the roadmap of tickets, the confirmed-task queue, the record of past agents — is kept off it entirely.

#### Business logic

The agent is told that this data lives on the dedicated branch `tf-data` and never on code branches, so its own checkout does not contain those files at all. To read one it fetches first and then reads the file directly out of the branch, using the remote copy when the local branch does not exist.

### Writes go straight to the data branch

#### User story

A triage or planning agent's whole output is a change to tickets or to the agent queue. That change should be visible to the next agent immediately, not whenever a pull request happens to be merged.

#### Business logic

The agent writes these files only when its instructions tell it to edit tickets or the queue. Such a write is a commit made on `tf-data` and pushed immediately; a rejected push is rebased and retried rather than abandoned.

#### Rationale

Pushing immediately and rebasing on rejection is what lets several agents change tickets and the queue concurrently without one overwriting another's entries.

### Data never mixes with code

#### User story

The user reviews an agent's pull request as a diff of code. Bookkeeping files appearing in it make the review noisy and stall the data change behind a code review.

#### Business logic

Two prohibitions carry this: the agent never switches its own checkout over to `tf-data`, and never puts these files on its agent branch. A data change is pushed directly and does not ride the pull request.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
