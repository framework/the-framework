Reads what an agent's [1] branch holds once its work has stopped — the commits, the changed files, whether the branch is pushed, merged or has a pull request — and carries out the handoff [2] steps the user clicks, so the agent's action bar and the detail it expands always agree about what is on the branch and what is left to do with it.

## Context

**User story**: an agent ends, or ends waiting [3] on a question, and its page offers the one step that moves the work forward: "Open PR" when the branch has commits and a remote, "Merge PR" once a pull request exists, "Push" where the project has no forge package. While that step runs the button says what it is doing ("Opening PR…", "Merging…", "Pushing…"), and when it fails the reason is shown instead of the button silently doing nothing. The summary above the button says what the branch holds, and expanding it lists the commits and files.

**Problem**: the same facts are needed in two places at once — the summary line and the actions in the action bar, and the commits and files the bar expands. Read separately they disagree with each other and cost twice the traffic.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Push", "Open PR" and "Merge" buttons do it by hand.
[3] waiting: how an agent that ended on a question reads: not working, its checkout kept, resumed by the answer or by the user's next message.
[4] project: a repository the user registered in the dashboard, identified by an id derived from its path.

## Business logic — TL;DR

- **Only read once the agent's work has stopped** - a branch still being written to has nothing to hand off.
- **Polled, because the branch changes behind the dashboard's back** - every 15 seconds at rest, every second while the pull request lookup has not answered.
- **The last answer stays on screen** - a failed read, and the change of polling cadence, never blank the summary.
- **One step at a time, and it says which one** - the step in flight is named, so the button reads as opening or merging rather than silently greying out.
- **A step that succeeds re-reads the branch at once** - the offer becomes the next step without waiting for the next poll.
- **A step that fails reports why** - the reason from the daemon, or the wording the button supplies.
- **"Not read yet" is distinguishable from "nothing there"** - an empty branch state is never flashed before the first answer lands.

## Business logic

### Only read once the agent's work has stopped

#### Context

**Problem**: while an agent [1] is still working, its branch is still being written to. Offering a handoff [2] then would offer to publish a half-written branch, and the answer would be stale the moment it was read.

#### Business logic

The branch is read only while the agent is not running: an agent that has ended counts, and so does one waiting [3] on a question, since its branch is finished work until it is resumed. While the agent is working nothing is read at all and no handoff is offered. Nothing is read either when no agent is selected.

### Polled, because the branch changes behind the dashboard's back

#### Context

**Problem**: the branch does not only change from this page. A push or a pull request opened from a terminal, and the pull request the agent opens itself, all change what is left to offer, and the page has no way to be told.

#### Business logic

The branch state is re-read every 15 seconds. While the answer says the pull request lookup has not finished — which is what holds the "Open PR" offer back — it is re-read every second instead, so the offer appears as soon as the lookup lands. The cadence returns to 15 seconds once the lookup has answered.

### The last answer stays on screen

#### Context

**Problem**: blanking the branch summary makes the action bar fall back to its rough live counts for a beat, which reads as the work having changed when only the page's own timing did.

#### Business logic

A read that fails leaves the last answer in place; the next read usually succeeds. Changing the polling cadence likewise keeps the last answer rather than starting from nothing. Switching to another agent [1] or another project [4] does clear it, so one agent's branch is never shown under another's.

### One step at a time, and it says which one

#### Context

**User story**: clicking "Open PR" must show that something is happening. A button that only greys out looks broken, especially when opening a pull request takes several seconds.

#### Business logic

Three steps can be carried out from here: opening the pull request (which pushes the branch on the way), merging it, and, where the project has no forge, pushing the branch alone. While one is in flight, that specific step is named, so the button reads "Opening PR…", "Merging…" or "Pushing…", and every step's button is unavailable until it finishes. Only one step is ever in flight.

### A step that succeeds re-reads the branch at once

#### Context

**User story**: after opening a pull request, the page should offer merging it, not keep offering to open it until the next poll comes round.

#### Business logic

A step that succeeds triggers an immediate re-read of the branch, so what is offered next is the next step of the handoff [2]. A step that fails does not.

### A step that fails reports why

#### Context

**User story**: opening a pull request can fail for reasons the user can act on — no remote, GitHub refusing it, no `gh` available — and the page says which.

#### Business logic

A step the daemon refuses is reported with the daemon's own reason. A step that fails with no reason of its own is reported with the wording the button supplies, such as "Could not open the pull request."

### "Not read yet" is distinguishable from "nothing there"

#### Context

**Problem**: an agent's [1] page opens before the branch has been read. Treating "not read yet" as "nothing on the branch" would flash "Nothing committed — no PR to open." at a user whose agent produced plenty.

#### Business logic

The branch state carries whether a read has actually answered for the current agent. Until it has, the page shows nothing about the branch rather than an empty branch, and the reasons the branch offers no step — "Branch gone — nothing to open a PR from.", "Nothing committed — no PR to open.", "No remote to push to." — are only shown once there is a real answer behind them.
