Builds the interventions list: the cross-project "needs you" queue, pooling everything across the user's registered projects that is waiting on a human decision — and phrases each item for a Discord notification.

## User story

The user wants one place that answers "what needs me right now?", across every project they registered, without clicking into each project in turn. Proposals and finished work both arrive as pull requests — merge to confirm, close to reject — so open pull requests are the bulk of it, joined by agents parked on a question and by finished work that never left the machine.

## Business logic — TL;DR

- **Three things need a human** - an open pull request to review, an agent parked at a gate waiting for a pick, and a finished agent whose commits were never pushed.
- **Drafts are off the list, except The Framework's own** - a draft opened by hand is not asking for review; a draft the handoff opened for an agent is exactly how finished work is handed back, so it stays on.
- **Only recent finished agents are inspected for unpushed work** - work that has sat unpushed for dozens of agents is not news, and each inspection costs several git reads on a poll.
- **One unreadable project never breaks the list** - a project with no remote, or one that could not be read, simply contributes nothing.
- **The list says which projects it saw whole** - so a caller that must not re-announce things can tell "nothing is waiting there" from "I could not look".
- **Newest first, each item once** - the same repository registered as two projects contributes its pull request only once.
- **One Discord message per batch** - each kind of item is phrased for the human reading it in chat.

## Business logic

### An open pull request to review

#### User story

Every proposal and every finished piece of work arrives as a pull request; the user confirms it by merging and rejects it by closing.

#### Business logic

Every registered project's open pull requests become items, carrying the pull request's number, title, link on GitHub, and when it was opened.

A draft pull request is normally left out: a draft is not asking for review. The exception is a draft on an agent branch — The Framework's handoff opens a pull request as a draft precisely so it does not ping reviewers, and dropping those too would mean nothing ever told the user the work exists.

### An agent parked at a gate

#### User story

An agent stops mid-task to ask the user a question. Until the user answers, the task is not moving.

#### Business logic

A running agent whose current state is an unresolved gate becomes an item, titled with the gate's question and pointing back at the dashboard. An agent parks on one gate at a time, but a project can have several agents at once, so each parked agent contributes its own item, identified by the gate together with the agent it belongs to — so that two parked agents are told apart and each is announced exactly once.

The dashboard's own address is only known to the daemon, so an item of this kind carries no link when the daemon does not know it.

### A finished agent whose work never left the machine

#### User story

An agent committed real code and stopped without pushing it — because the project has automatic handoff switched off, or that agent did, or the push was attempted and failed. Nothing else on the dashboard would say so: the overview only shows running agents, and the handoff panel is behind clicking into that agent.

#### Business logic

For each project, the most recent finished agents are checked — five by default. An agent contributes an item only when its branch still exists, holds commits, has not been merged, has not been pushed, and there is a remote to push to; every other case is a reason the work is *not* waiting on anyone. The item names the agent's task, its branch and how many commits are waiting.

This surfaces the decision, it does not take it: nothing is pushed on the user's behalf here.

#### Rationale

Only the recent finished agents are inspected because each one costs several git reads and this list is rebuilt on a poll; work that has sat unpushed for dozens of agents is no longer news, and the agent's own record remains. The check also deliberately skips looking up the branch's pull request: an open pull request means the branch was pushed, which already excludes it, and the pull request kind above is what surfaces it anyway — paying a network lookup per agent on every poll would be the most expensive part of building this whole list.

### Which projects were read whole

#### User story

The Discord and browser notifications for interventions announce only what is new, by remembering what they already announced. A project that is temporarily unreachable must not make the next successful read announce that project's entire backlog as new.

#### Business logic

Alongside the items, the list reports which projects had *every* one of their sources answer. A project counts as read whole only when its pull request listing, its live agents and its finished-agent inspection all succeeded; any source that failed — rather than genuinely finding nothing — leaves that project out.

The dashboard's panels ignore this and just render the items; the notification watcher is the caller that cannot.

### Ordering and de-duplication

#### Business logic

Items are ordered newest first, by when the pull request was opened or when the agent last changed. The same repository can be registered as two projects — a monorepo root and a subdirectory, for instance — which would otherwise contribute the same pull request once per registration, so items with the same identity are collapsed and the newest kept.

### How an intervention reads on Discord

#### User story

The user gets a Discord message for what needs them, and must be able to act from the message alone.

#### Business logic

A batch is posted as one Discord message: a single item reads as "Needs you" with the project's name, and several are listed as bullets under a count. Each kind is phrased for what the reader must do with it:
- a pull request reads as its number, title and link;
- a parked agent reads as its question followed by "awaiting your answer", with the dashboard link appended when it is known;
- unpushed work reads as the task, the number of commits and the branch they sit on, noted as never pushed.

An empty batch posts nothing and counts as delivered.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
