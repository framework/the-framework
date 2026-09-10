Derives what the dashboard shows about an agent [1] from its event stream [2]: its progress (the session name [3] it gave its work and whether it is ready for merge [4]), the errors it reported, the handoff [5] it is armed for and how the handoff went, and the driver session [6] behind it (driver, checkout [7], session id and link, model). Every derivation is a fold over the events, so the live agent view [8] and the replay of a finished agent show the identical summary.

## Context

**User story**: the agent view's status label and dot (orange while building, green once ready), the session name the agent is labeled by, the error count and the latest headline beside it, the armed line saying what the agent will do with its work, the outcome bar after the handoff, and the "open session" and "Resume" affordances are all read from these projections.

**Business logic story**: nothing here is state of its own. An error is an event that happened, so the list only grows; the armed handoff is whatever the latest announcement said; the session behind the agent is the latest leg's.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] agent view: one agent's page.
[9] the Overview: the dashboard's cross-project page at `/`.
[10] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[11] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[12] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **Progress: the session name and ready for merge** - the name is the one carried by the latest branch observation, an observation without a name leaving the agent unnamed, and the agent is building until the ready-for-merge signal has been seen.
- **The session name of a view built from the record** - a name is present only when the agent's branch carries one, so an unnamed agent has no name rather than an empty one.
- **The errors the agent reported** - every error the agent reported, oldest first, each with its headline and its detail when the agent wrote one.
- **The armed handoff and its outcome** - push and pull request read as armed until an announcement says otherwise, merge reads as off until one says so, a record snapshot may seed all three, the latest announcement wins, and the handoff's outcome is carried once it has run.
- **The session behind the agent** - nothing before the session opening; then the driver, the checkout, the link and the model of the latest leg, plus the id and link of the latest session update.

## Business logic

### Progress: the session name and ready for merge

#### Context

**User story**: the agent view [8] labels the agent by the session name [3] it chose, and its dot turns from orange (building) to green (ready) when the agent declares its work complete.

#### Business logic

The session name is the one carried by the latest branch observation in the stream. A latest observation without a name leaves the agent unnamed, whether the branch is the one the checkout [7] was born on or a branch The Framework did not mint, even when an earlier observation carried a name; the writer of the observation is the one that knows which branch the checkout was created on, never this reader. The agent is ready for merge [4] once a ready-for-merge signal appears anywhere in the stream, and building before. An agent with no events at all is building and unnamed.

### The session name of a view built from the record

#### Context

**Business logic story**: the Overview [9] and the list of open questions [10] build their rows from an agent's record (its branch and its agent id [11]) rather than from its event stream [2], and every such row must spell the name the same way.

#### Business logic

The name is derived from the branch by the `branches` skill's rule: an `agent-<name>` branch that is not the agent's birth branch (the one named by the agent id) yields `<name>`; any other branch, or no branch, yields no name. The field is present only when there is a name, so a view of an unnamed agent carries no name rather than an empty one.

### The errors the agent reported

#### Context

**User story**: the agent view shows how many errors the agent ran into that only the user can fix ("gh is not logged in") and the latest headline beside the count. Reopening a finished agent shows exactly what it showed while running.

#### Business logic

Every error report in the stream, in order, becomes one entry with its headline and, when the agent wrote one, its detail (what it ran and what that said). Nothing removes an entry: an error is something that happened.

### The armed handoff and its outcome

#### Context

**User story**: the agent view's armed line says what the agent will do with its work when it ends, the action bar's checkboxes change it while the agent runs, and once the handoff [5] has run the bar shows what happened: the pull request's URL, the reason it was skipped, or the failure beside a retry button.

**Problem**: the agent writes its first armed announcement as its very first event, before a live dashboard tab has attached, so a tab that only folds the live stream would miss it and show the default. The agent's record mirrors the armed state, and a reader may seed the projection from it.

#### Business logic

- The starting point is push armed, pull request armed, merge off. Push and pull request default to armed because that is what an agent does when nothing says otherwise; merge defaults to off because landing on the default branch is opt-in, and silence must never read as an agent that will merge by itself.
- A reader may seed push, pull request and merge from the agent's record; the seed stands in for the opening announcement a live stream missed.
- Every armed announcement in the stream overrides push and pull request. It overrides merge only when it carries a merge flag, so an announcement without one keeps the seed rather than flipping an armed merge off. The latest announcement wins, which is what makes unticking a box stick.
- Once a handoff outcome is in the stream it is carried as: done, with the pull request URL when one was opened; failed, with the error; or skipped, with the reason. It is absent while the agent is still going. The merge half's own outcome is not part of this projection.

### The session behind the agent

#### Context

**User story**: "open session" jumps into the coding agent's own session, and "Resume" reopens a finished agent's conversation, which needs the session id together with the directory the agent ran in.

#### Business logic

Nothing is known before the session opening event; a stream without one yields no session. The opening gives the driver [12], whether it is the fake demo driver, the checkout [7] the agent ran in, the session link when the opening had a literal one, and the model when one was recorded. Each session update then sets the session id and, when it carries one, the link, and keeps the rest. A continuation emits a new session opening, so the driver, the checkout and the model are the latest leg's: a leg that recorded no model clears the model rather than keeping the previous leg's. The checkout is taken from the event on purpose: a finished agent's checkout is removed, and the event is the only surviving record of where it lived.
