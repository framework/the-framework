Builds the cross-project "needs you" list, the interventions [1] feed: every registered project's open pull requests waiting for review, every agent [2] waiting on the gate [3] it ended on, and every recently finished agent whose branch holds commits that never left the machine, newest first, each with one stable identity so the notification sweep announces it exactly once. It also reports which projects it could read completely, and it phrases the items for Discord and posts them there as one message.

## Context

**User story**: the user sees, on one card across all projects, what is waiting for a human right now: a pull request to merge (confirm) or close (reject), a question an agent [2] stopped to ask, or work an agent committed but never pushed. With a Discord webhook configured, the same items reach the user as a message, each announced once. The daemon's notification sweep [4] (`keyed-watcher.ts`) runs this read on its clock and decides what is new; the dashboard's card renders the same list.

**Problem**: proposals and finished work are both pull requests, so the bulk of what needs a human is the set of open pull requests across the registered projects. Two more kinds would otherwise stay invisible: an agent parked on a gate [3] only shows on its own page, and a finished agent that committed real code and stopped without pushing shows nowhere, since the Overview [5] lists running agents only and the handoff [6] panel sits behind clicking into that agent.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[4] sweep: a background job the daemon runs on its clock: the data sync, the notification watchers, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[5] the Overview: the dashboard's cross-project page at `/`.
[6] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[7] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[9] branches provider: the package of the project that declares it provides the checkouts and branches; The Framework reads a branch's state and moves branches through the command that package declares (`../store/branches.ts`).
[10] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Open pull requests to review** - every open pull request of every project is an item, except a draft opened by hand; a draft on a branch one of the project's agents is on stays, because a draft is how an agent's work may ask for a first look.
- **Agents parked on a gate** - an agent that ended `waiting` on a gate is an item carrying the question's title, read off the agent's own diary, one item per parked agent.
- **Finished agents with unpushed work** - among a project's 5 most recent finished agents, their branches read in one ask of the branches provider [9], one whose branch still exists, holds real commits, is neither merged nor on the remote, and has a remote to push to, is an item naming what was asked (else the name the provider answers for the branch, else the branch), the branch and the commit count.
- **Newest first, one item per identity** - items sort by when the pull request was opened or the agent last updated, and a pull request seen through two projects registered on the same repository appears once.
- **Which projects were read whole** - alongside the items comes the list of projects every source answered for, so a silence caused by an unreachable project is never mistaken for "nothing waiting".
- **How the feed reads on Discord** - one line per item shaped by its kind, posted as one "Needs you" message, or nothing at all when there is nothing to say.

## Business logic

### Open pull requests to review

#### Context

See `## Context`.

#### Business logic

For each registered project, the open pull requests of its repository (read through the project's forge provider by the rule in `pull-requests.ts`, at most 50) each become one item with the pull request's number, title, URL and opening time; the URL is where to act, on the forge. A draft pull request is left out, because a draft is not asking for review, with one exception: a draft whose head branch is an agent's [2] branch, the branch a finished agent's record names or a working agent's checkout is on, is kept. An agent publishes its pull request as a draft when a person should look at it first, and cloud work adoption opens its pull requests as drafts so they do not ping reviewers; if the feed dropped them too, nothing would tell anyone the work exists. A draft with no head branch recorded counts as opened by hand, so an answer that lacks the branch never turns every draft in the repository into a "needs you". A project whose pull requests cannot be read (the forge provider refusing: no remote, not logged in, the forge unreachable) contributes no pull request items and does not count as read whole; a project with no forge provider has no pull requests and counts as read whole.

### Agents parked on a gate

#### Context

**User story**: an agent [2] stops mid-work to ask the user something; until the user answers, the question is a "needs you" wherever the user looks, not only on the agent's own page.

#### Business logic

For each project, every agent [2] with a checkout whose status is `waiting` is looked at: it ended on a gate [3] and waits for the answer, its checkout kept. The gate is read off the agent's own diary by the same rule the run page and the open-questions list use (`open-choices.ts`): the last question still open. One item per such agent: its title is the question's title, and it links to the dashboard's own URL when the daemon knows it (only the daemon does; the dashboard's card locates the project itself and needs no URL), else its link is empty. A project may have several agents waiting at once, so each contributes its own item, identified by the project, the agent and the gate: every agent's first gate can carry the same gate id, so without the agent in the identity two parked agents would count as one and only one would be announced. An agent that is not `waiting`, or whose diary cannot be read or shows no open question, contributes nothing. When the project's live agents cannot be read, no such items are contributed.

### Finished agents with unpushed work

#### Context

**Problem**: an agent [2] that committed real code and stopped without pushing produces neither a pull request nor a gate, and nothing would tell anyone. Agents usually push themselves as part of their handoff [6], so what reaches here is the remainder: an agent told that whoever started it publishes for it, or a handoff that failed or never ran. The feed only says that a decision is waiting; it does not take it.

#### Business logic

For each project, only the 5 most recent finished agents [2] (every agent whose status is not running, newest by start time first) are inspected, since the feed is re-read on a poll: work that has sat unpushed for dozens of agents is not news, and the agent list remains the record of it. An agent whose record carries no branch is not inspected: it has no branch to push. The branches of those agents are read in one ask of the project's branches provider [9], which answers each branch's git facts (whether it exists, its commits and changed files since the base branch, whether it is pushed and merged, whether the repository has a remote) and no pull request: an open pull request means the branch was pushed, which already excludes it, and the pull request kind above is what surfaces it, so a network call per agent on every poll would buy nothing. A project with no branches provider has no checkouts and nothing unpushed.

The agent is an item only when none of these holds, each being a reason nobody is waited on: the provider did not answer for the branch, the branch is gone, the agent wrote nothing (no commit beyond what the base branch already has, or commits that change no file), the branch is already merged, the branch is already on the remote at the same commit, or the repository has no remote to push to. The item's title is what the agent was asked to do, or the branch name when no request was recorded; it names the branch and how many commits are waiting, links to the dashboard's URL when known, is identified by the project and the agent, and carries the agent's last update time. A provider read that fails leaves the project with no such items, and the project does not count as read whole.

### Newest first, one item per identity

#### Context

**Problem**: the same repository can be registered as two projects (a monorepo root and one of its packages), so one pull request would otherwise show once per project.

#### Business logic

Items across all projects sort newest first, by the pull request's opening time for a pull request and by the agent's [2] last update time for the other two kinds; an item with no time sorts last. Each item has one stable identity (`keys.ts`): a pull request is its URL, which survives title edits and re-sorts; a parked agent is the project, the agent and the gate [3]; unpushed work is the project and the agent. Two items with the same identity collapse to the first in the newest-first order.

### Which projects were read whole

#### Context

**Problem**: forgiveness is what keeps the feed useful when one project is unreachable, and it is also what would let everything already open in that project announce itself as new the moment it came back: the notification sweep [4] keeps a baseline of what it has already announced, and a project that answered "nothing" because it could not be read would drop out of that baseline.

#### Business logic

A project is read whole only when every one of its sources answered: its open pull requests, its live agents [2], its finished agents, and the branch states of the inspected finished agents. Any source that failed makes the project contribute what the other sources found, but not count as read whole. The list of projects read whole comes back beside the items. The dashboard's card ignores it; the notification sweep [4] is the caller that cannot, because it must not take "could not look" for "nothing there".

### How the feed reads on Discord

#### Context

**User story**: with a Discord webhook configured in the preferences [10], the user is told in Discord what needs them, in a form they can act on from the message.

#### Business logic

Each kind has its own line. A pull request reads as its number, title and URL ("#123 Title — url"). A parked agent [2] has no number and only the dashboard link, so it reads as the question's title followed by "awaiting your answer", with the link appended when the daemon knows it. Unpushed work reads as what was asked, then the commit count ("1 commit", or "N commits"), the branch it sits on and "never pushed", with the dashboard link when known, since the branch is the actionable part. A batch is one message: nothing is posted when there is nothing to say (and that counts as delivered); a single item posts "Needs you (project name): line"; several items post "N items need you:" followed by one bulleted line each. The message goes out through `discord-webhook.ts`, which cuts it to Discord's limit and answers whether Discord accepted it.
