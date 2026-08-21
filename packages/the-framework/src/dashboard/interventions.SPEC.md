The cross-project "needs you" queue: everything currently waiting on the human, gathered from every registered project.

## User Stories

- The user sees, in one queue, everything across their projects that only they can move forward.
- The user gets a Discord message when items need them, one line per item.
- The user learns about finished work that was never pushed, instead of it sitting invisible on a branch.

## Flows

- Three kinds of item: an open pull request to review, an agent parked on a question, and a finished agent whose commits were never pushed.
- A draft PR the user opened by hand stays off the queue — it is not asking for review yet. An agent's own draft stays on: the automatic handoff opens draft PRs precisely so reviewers are not pinged, and the queue is then the only place the work is visible at all.
- Unpushed work is surfaced, never acted on, and only a project's few most recent finished agents are inspected — work sitting unpushed for ages is not news.
- Forgiving and deduplicated: an unreadable project contributes nothing, and the same repo registered twice contributes each item once.
- Also phrases the queue as a Discord message, one line per item, worded by kind.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
