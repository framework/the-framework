The cross-project "needs you" queue: everything currently waiting on the human, gathered from every registered project.

## TLDR

- Three kinds of item: an open pull request to review, an agent parked on a question, and a finished agent whose commits were never pushed.
- Hand-opened draft PRs stay off the queue (they are not asking for review yet); an agent's own draft stays on it — the automatic handoff opens drafts precisely so reviewers are not pinged, and the queue is then the only place the work is visible at all.
- Unpushed work is surfaced, never acted on, and only a project's few most recent finished agents are inspected — work sitting unpushed for ages is not news.
- Forgiving and deduplicated: an unreadable project contributes nothing, and the same repo registered twice contributes each item once.
- Also phrases the queue as a Discord message, one line per item, worded by kind.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
