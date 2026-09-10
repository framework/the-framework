Builds the cross-project "needs you" list, the interventions [1] feed: every registered project's open pull requests waiting for review, every running agent [2] parked on a gate [3], and every recently finished agent whose branch holds commits that never left the machine, newest first, each with one stable identity so the notification sweep announces it exactly once. It also reports which projects it could read completely, and it phrases the items for Discord and posts them there as one message.

## Context

**User story**: the user sees, on one card across all projects, what is waiting for a human right now: a pull request to merge (confirm) or close (reject), a question an agent [2] stopped to ask, or work an agent committed but never pushed. With a Discord webhook configured, the same items reach the user as a message, each announced once. The daemon's notification sweep [4] (`keyed-watcher.ts`) runs this read on its clock and decides what is new; the dashboard's card renders the same list.

**Problem**: proposals and finished work are both pull requests, so the bulk of what needs a human is the set of open pull requests across the registered projects. Two more kinds would otherwise stay invisible: an agent parked on a gate [3] only shows on its own page, and a finished agent that committed real code and stopped without pushing shows nowhere, since the Overview [5] lists running agents only and the handoff [6] panel sits behind clicking into that agent.

## Glossary

[1] intervention: Something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] the Overview: The dashboard's cross-project page at `/`.
[6] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[7] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.

## Business logic — TL;DR

- **Open pull requests to review** - every open pull request of every project is an item, except a draft opened by hand; a draft on an agent's branch stays, because that is how an unattended handoff hands work back.
- **Agents parked on a gate** - a running agent with an unanswered gate is an item carrying the question's title, one item per parked agent.
- **Finished agents with unpushed work** - among a project's 5 most recent finished agents, one whose branch still exists, holds real commits, is neither merged nor on the remote, and has a remote to push to, is an item naming what was asked, the branch and the commit count.
- **Newest first, one item per identity** - items sort by when the pull request was opened or the agent last updated, and a pull request seen through two projects registered on the same repository appears once.
- **Which projects were read whole** - alongside the items comes the list of projects every source answered for, so a silence caused by an unreachable project is never mistaken for "nothing waiting".
- **How the feed reads on Discord** - one line per item shaped by its kind, posted as one "Needs you" message, or nothing at all when there is nothing to say.

## Business logic

### Open pull requests to review

#### Context

See `## Context`.

#### Business logic

For each registered project, the open pull requests of its repository (read through `gh.ts`, at most 50) each become one item with the pull request's number, title, URL and opening time; the URL is where to act, on GitHub. A draft pull request is left out, because a draft is not asking for review, with one exception: a draft whose head branch is an agent's [2] branch (a branch named `agent-…`, other than the `agent-data` branch itself) is kept. An unattended handoff [6] opens its pull request as a draft precisely so it does not ping reviewers, and if the feed dropped it too, nothing would tell anyone the work exists. A draft with no head branch recorded counts as opened by hand, so an answer that lacks the branch never turns every draft in the repository into a "needs you". A project whose pull requests cannot be read (no remote, `gh` missing or logged out, GitHub unreachable) contributes no pull request items.

### Agents parked on a gate

#### Context

**User story**: an agent [2] stops mid-work to ask the user something; until the user answers, the question is a "needs you" wherever the user looks, not only on the agent's own page.

#### Business logic

For each project, every live agent [2] whose status is still running and which has a gate [3] nobody has answered is one item: its title is the question's title, and it links to the dashboard's own URL when the daemon knows it (only the daemon does; the dashboard's card locates the project itself and needs no URL), else its link is empty. An agent parks on one gate at a time, but a project may have several agents running at once, so each parked agent contributes its own item, identified by the project, the agent and the gate: every agent's first gate carries the same gate id, so without the agent in the identity two parked agents would count as one and only one would be announced. A gate left on an agent that is no longer running is ignored. When the project's live agents cannot be read, no such items are contributed.

### Finished agents with unpushed work

#### Context

**Problem**: an agent [2] that committed real code and stopped without pushing produces neither a pull request nor a gate, and nothing would tell anyone. Agents usually push themselves, so what reaches here is the remainder: the handoff [6] turned off for the project or for that agent, or a handoff that tried and failed. The feed only says that a decision is waiting; it does not take it.

#### Business logic

For each project, only the 5 most recent finished agents [2] (every agent whose status is not running, newest by start time first) are inspected, since each inspection costs several git reads and the feed is re-read on a poll: work that has sat unpushed for dozens of agents is not news, and the agent list remains the record of it. For each of those agents the branch is the one recorded for it, or, when no record exists, the branch its agent id [7] names. The branch's state is read as for the handoff summary (`agent-handoff.ts`), except that the pull request lookup is skipped: an open pull request means the branch was pushed, which already excludes it, and the pull request kind above is what surfaces it, so an 8-second network call per agent on every poll would buy nothing.

The agent is an item only when none of these holds, each being a reason nobody is waited on: the branch is gone, the agent wrote nothing (no commit beyond what the base branch already has), the branch is already merged, the branch is already on the remote at the same commit, or the repository has no remote to push to. The item's title is what the agent was asked to do, or the branch name when no request was recorded; it names the branch and how many commits are waiting, links to the dashboard's URL when known, is identified by the project and the agent, and carries the agent's last update time. A branch that cannot be read is skipped rather than failing the feed.

### Newest first, one item per identity

#### Context

**Problem**: the same repository can be registered as two projects (a monorepo root and one of its packages), so one pull request would otherwise show once per project.

#### Business logic

Items across all projects sort newest first, by the pull request's opening time for a pull request and by the agent's [2] last update time for the other two kinds; an item with no time sorts last. Each item has one stable identity (`keys.ts`): a pull request is its URL, which survives title edits and re-sorts; a parked agent is the project, the agent and the gate [3]; unpushed work is the project and the agent. Two items with the same identity collapse to the first in the newest-first order.

### Which projects were read whole

#### Context

**Problem**: forgiveness is what keeps the feed useful when one project is unreachable, and it is also what would let everything already open in that project announce itself as new the moment it came back: the notification sweep [4] keeps a baseline of what it has already announced, and a project that answered "nothing" because it could not be read would drop out of that baseline.

#### Business logic

A project is read whole only when every one of its sources answered: its open pull requests, its live agents [2], its finished agents, and the branch state of each inspected finished agent. Any source that failed makes the project contribute what the other sources found, but not count as read whole. The list of projects read whole comes back beside the items. The dashboard's card ignores it; the notification sweep [4] is the caller that cannot, because it must not take "could not look" for "nothing there".

### How the feed reads on Discord

#### Context

**User story**: with a Discord webhook configured in the preferences, the user is told in Discord what needs them, in a form they can act on from the message.

#### Business logic

Each kind has its own line. A pull request reads as its number, title and URL ("#123 Title — url"). A parked agent [2] has no number and only the dashboard link, so it reads as the question's title followed by "awaiting your answer", with the link appended when the daemon knows it. Unpushed work reads as what was asked, then the commit count ("1 commit", or "N commits"), the branch it sits on and "never pushed", with the dashboard link when known, since the branch is the actionable part. A batch is one message: nothing is posted when there is nothing to say (and that counts as delivered); a single item posts "Needs you (project name): line"; several items post "N items need you:" followed by one bulleted line each. The message goes out through `discord-webhook.ts`, which cuts it to Discord's limit and answers whether Discord accepted it.
