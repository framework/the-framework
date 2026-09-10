Lists, removes and deletes the checkouts [1] that a project's agents [2] leave under `.branches/`: one list of the retained checkouts [3] that every surface shows, one removal behind the dashboard's "Remove" button, the daemon's sweep [4] and its teardown of an agent, the deletion of an agent together with its records, and the removal of every retained checkout at once. The git side of a removal is the `branches` skill's [5] rule (`reclaim.ts` in that package): only what is on the remote may go. What this file adds is the agent's side: its record decides what that rule may do, and every refusal is worded the same way on every surface.

## Context

**User story**: the user sees, on the dashboard and through the CLI, which checkouts [1] are still on disk, each with the branch its work landed on, how its agent [2] ended and its size, and removes one, or all of them, to get the disk back. Nothing the product removes on its own is ever lost: it is on the remote first. Deleting an agent takes it out of the dashboard for good, which is why the surfaces that offer it confirm first.

**Problem**: git cannot tell whether a branch may be pushed at all, nor whether a cloud session [6] already pushed the work under a commit of its own; both are the agent's record's to say. A record that cannot be read must not be mistaken for "publish freely", and a checkout whose agent is still working is where that agent works: a stop [7] is how an agent ends, not pulling the floor out from under it.

## Glossary

[1] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] retained checkout: a checkout still on disk after its agent ended.
[4] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] skill: One of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[6] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] stop: Ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[8] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[9] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[10] reclaim: Removing a finished agent's checkout once its work is on the remote.
[11] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[12] location: Where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[13] cloud anchor: An empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it.
[14] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[15] run: Only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[16] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[17] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.

## Business logic — TL;DR

- **The retained checkouts, newest first** - every directory under `.branches/`, joined with its agent's record: the branch, how the agent ended, whether it is still in use, and its size on disk for a finished agent.
- **Removing one checkout** - refused for an unsafe id, an unknown checkout, a running agent or an unreadable record; otherwise the record tells the git rule whether a push is allowed and which pushed commit vouches for the tree, and the rule decides.
- **How a refusal is worded** - one wording per reason, the same on the dashboard, in the CLI and in the daemon's log; a publish-nothing agent's refusal names its handoff.
- **Deleting an agent** - takes the agent out of the dashboard, records and all, discarding uncommitted work with the checkout; its branch and commits stay.
- **Removing every retained checkout** - each finished agent's checkout goes through the one removal; a live one is skipped as "still running", and every skip names its reason.

## Business logic

### The retained checkouts, newest first

#### Context

**User story**: the dashboard's list of retained checkouts [3] and the CLI's show the same rows from the same reads, so the CLI is a second surface and not a second behavior. A live agent's [2] checkout [1] is listed and flagged rather than hidden, because "what is this directory and why can I not remove it" is exactly the question the list answers.

#### Business logic

Every directory under the project's `.branches/` is a row, named by the agent id [8] that is also the directory's name (the listing is the `branches` skill's [5]). Each row is joined with the agent's record, the live one in the checkout [1] first, else the archived [9] one: the branch the agent's work landed on when the record has one, how the agent ended (`done`, `stopped`, `failed`) or `running` while it is still going, and whether it is live, which is exactly a status of `running`: in use, not retained. A finished agent's size on disk is measured unless the caller asks for rows only, as the dashboard's list does; a live agent's tree is never measured, since a number for a tree being written to is wrong by the time it prints, and a size that cannot be read is simply absent. Rows are ordered newest first by agent id, which is derived from the agent's start. A listing, record or archive that cannot be read contributes nothing rather than failing the list.

### Removing one checkout

#### Context

**Business logic story**: this is the one implementation behind every surface that removes a checkout [1]: the sweep [4] that reclaims [10] checkouts, the daemon's teardown of an agent [2], and the dashboard's "Remove" button. The git rule it hands the decision to is described with the `branches` skill's [5] `reclaim.ts`: a clean tree whose tip the remote has, pushed here when allowed, and nothing committed on the agent's behalf.

#### Business logic

Before any git command runs, in this order:

- An id that is not a safe agent id [8] is refused: "invalid session id: <id>".
- An id with no directory under `.branches/` is refused: "no worktree for session <id>".
- An agent whose live record says it is still running is refused: "that session is still going; stop it before removing its worktree".
- The agent's record is read strictly: the live copy in the checkout [1] (`.the-framework/agent.json`), else the archived [9] one. No record at all is a boot death and keeps the recoverable default below; a record that exists but cannot be read or parsed refuses the removal, "session <id>'s record could not be read (<error>); its worktree was kept", because an unreadable record cannot tell a publish-nothing agent from any other. The removal fails closed and a later pass retries it.

The record then tells the git rule what git cannot know:

- Whether the branch may be pushed to make the removal possible. It may not when the record's handoff [11] says the branch is not to be pushed (handoff `local`, a publish-nothing agent): the removal's own push would publish the very branch the handoff declined to. Without a handoff on the record, a push is allowed.
- For an agent whose location [12] is `web` and whose record carries its cloud anchor [13], that commit vouches for the checkout's content: a clean tree whose tip is inside it goes without a push. A tree holding more than the anchor carried falls back to the ordinary rule.
- The birth branch [14], `agent-<agent id>`, so that a branch the agent branched away from goes with the checkout once the branch that stays contains it.
- The caller's hook, run once removal is decided and just before the checkout goes; the dashboard stops the preview serving that tree there, and the CLI has none to stop.

Success reports the branches that went with the checkout, when any did. A git failure past the decision is reported as the error with git's own words.

### How a refusal is worded

#### Context

**Problem**: the same refusal reaches the user from the dashboard, the CLI and the daemon's log, and must read the same everywhere.

#### Business logic

Each of the git rule's refusals is said once, naming the agent [2]:

- A directory git does not know as a worktree: "session <id>'s directory is not a git worktree; left alone".
- A checkout [1] on no branch: "session <id> is on no branch; its worktree was kept".
- Uncommitted work: "session <id> has uncommitted work; its worktree was kept". For a publish-nothing agent it is instead "session <id> was set to publish nothing (handoff: local); its worktree was kept": such a checkout goes only once everything it holds is on the remote by someone's explicit act, and nothing is committed on the way to the refusal.
- A branch not on the remote: "<branch> is not on the remote (<git's words, or "not pushed">); its worktree was kept", or, for a publish-nothing agent, the same publish-nothing wording as above.

### Deleting an agent

#### Context

**User story**: the user deletes an agent [2] from the dashboard after confirming, and its row is gone for good: the checkout [1], the record that listed it and the event stream [17] that replayed it. Removing a checkout, by contrast, keeps the agent's row and its history.

**Problem**: a branch may carry merged work or an open pull request, and deleting one is not a thing a dashboard action should do silently; delete means "remove from the dashboard", not "erase every trace".

#### Business logic

An id that is not a safe agent id [8] is refused before anything is touched: "invalid session id: <id>". An agent whose live record says it is still running is refused: "that session is still going; stop it before deleting it". Otherwise, when a checkout [1] is on disk, the caller's hook runs first (the dashboard stops the preview serving the tree), then the worktree is force-removed, its uncommitted work discarded with it, since the agent is being thrown away, and git's records of worktrees whose directories are gone are pruned. Then the records that put the row in the list go: when the agent's run [15] is on the `agent-data` branch [16], the `logs` skill [5] deletes its card and diary as one committed, pushed change, and only a deletion that could not even be committed fails the delete; otherwise the transient archive [9] files under `.the-framework/agents/` are removed, tolerant of files already gone, so an agent whose checkout was already removed still finishes cleanly. The agent's branch, `agent-<agent id>` or the name the agent gave it, and its commits are left in place: they are git's, not the dashboard's.

### Removing every retained checkout

#### Context

**User story**: "clean all of this up": the user asks for every retained checkout [3] to go, and the count reported adds up to what the list showed.

#### Business logic

Every row of the retained checkouts [3] list is visited. A live agent's [2] row is skipped with the reason "still running". Every other row goes through the one removal above; a removal that succeeds is counted as removed, and one that is refused is counted as skipped with the refusal's wording as its reason, so a checkout whose branch could not reach the remote is accounted for rather than silently left.
