Pools every running agent's pending gate, across all projects, into the dashboard's open questions list — so the user answers from one place instead of hunting through each agent's view.

## User story

Several agents run at once and two of them park on a choice. The user opens the dashboard and sees both questions side by side, oldest first, with the full choice — every option, whether more than one option can be picked, and which option is recommended — ready to answer on the spot.

## Business logic — TL;DR

- **Only genuinely open gates are offered** - a gate is listed only if the agent's own event log still shows it unanswered.
- **Longest-waiting first** - the agent that has been blocked on its human the longest is listed first.
- **A broken project is silently absent** - anything unreadable contributes no questions rather than breaking the list.

## Business logic

### Only genuinely open gates are offered

#### User story

The user answers a question from the pooled list, or answers it inside the agent's own view; either way the question must disappear and must never be answerable twice.

#### Business logic

Each running agent that reports a pending gate is checked against its own event log, read from the agent's worktree rather than the project root. The gate counts as open only when the log records it being asked with no later record of it being answered; otherwise the agent contributes nothing to the list. Each listed question carries the whole choice as it was asked — all options, single- or multi-select, the recommended option, and the accompanying detail — because the pooled list must be able to answer it, not merely count it.

#### Rationale

The agent's status record names only the pending gate's id and title, which is all the dashboard's badge needs; the options themselves only exist in the event log, so the log is the source of truth for both the gate's contents and whether it is still open. Offering an answer the daemon would then refuse is worse than showing one card fewer.

### Longest-waiting first

#### User story

With a handful of parked agents, the user wants to unblock whoever has been stuck longest rather than scanning timestamps.

#### Business logic

Questions are ordered by when their agent last spoke, earliest first.

### A broken project is silently absent

#### User story

One registered project has been deleted from disk or has an unreadable agent record; the user still expects the other projects' questions.

#### Business logic

A project whose agent list or event log cannot be read contributes no questions, and the rest of the list is still returned.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
