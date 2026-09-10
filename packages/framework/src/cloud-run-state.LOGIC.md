Decides the one word every surface shows for what a web agent [1]'s cloud side is doing — "waiting", "in cloud", "merged" or "done" — from facts the daemon already holds about the agent [1]: whether the Claude web bridge [4] holds a gate [5] its cloud session [3] is parked on, whether its pull request was merged, whether it has a pull request at all, and how long ago it started. Every other agent gets no cloud word, and its own status is what its row says.

## Context

**User story**: the user starts several web agents [1] and watches the dashboard's agent list and the Overview [7]. An agent whose cloud session [3] is still working reads "in cloud", one whose session stopped to ask something reads "waiting", one whose pull request The Framework merged reads "merged", and one that is over reads "done" like any other finished agent.

**Problem**: a web agent's local half ends the moment it hands the task to a cloud session, so from then on its stored status is "done" — which says nothing about whether the session is still working on claude.ai, is parked on a question, or finished long ago. Marking every such agent "in cloud" forever is the opposite error: an agent whose pull request merged two days ago is not in the cloud. The word has to come from what is actually known about the session.

**Business logic story**: this rule lives on its own, free of anything only a server can do, so the browser app, the dashboard's agent list and the Overview [7] all derive the same word from the same rule rather than each inventing one. It is part of what the browser may import (`client.ts`).

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. A web agent is one whose location is `web`.

[2] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).

[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

[4] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.

[5] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.

[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).

[7] the Overview: the dashboard's cross-project page at `/`.

[8] cloud work adoption: recognizing the branch a cloud session pushed as the web agent's, by its descent from the agent's cloud anchor, and recording it on the agent's record.

## Business logic — TL;DR

- **Which agents get a cloud word at all** - only an agent whose location is `web` and whose local half ended cleanly; every other agent is described by its own status.
- **Parked on a human comes first** - a cloud session the bridge reports as holding an unanswered question reads "waiting", whatever else is known.
- **Merged outranks everything else known** - an agent whose pull request The Framework merged reads "merged".
- **A recorded pull request means the work landed** - once a pull request is on the agent's record, the word is "done" and the pull request's own badge carries its live state.
- **Inside the session window, still in the cloud** - with no pull request, an agent started within the last 12 hours reads "in cloud"; past that window, or with an unreadable start time, it reads "done".
- **What still counts as an agent at work** - "waiting" and "in cloud" mean the cloud side is still working or still owed an answer; "merged" and "done" mean it is over.

## Business logic

### Which agents get a cloud word at all

#### Context

See `## Context`.

#### Business logic

A cloud word exists only for an agent [1] whose location [2] is `web` and whose recorded status is "done" — its local half ran to a clean end, which for a web agent means the task was handed to a cloud session [3]. A local agent, a GitHub Actions agent, an agent relayed to a device, and a web agent that is still running, was stopped or failed all get no cloud word: their own status is the word their row shows, unchanged.

### Parked on a human comes first

#### Context

**User story**: the cloud session asks a question; the user should see that the agent is waiting on them, not that it is busy in the cloud.

#### Business logic

When the agent [1]'s record is marked as having a cloud session [3] parked on a question — the mark the daemon adds on the way to the dashboard, from what the Claude web bridge [4] holds (`dashboard-rpc/reads.ts`) — the word is "waiting". This outranks every other fact: an agent whose session is asking something is waiting on a human even if it has already pushed a pull request.

### Merged outranks everything else known

#### Context

**Business logic story**: an agent's handoff [6] records how its merge half went, and cloud work adoption [8] records the pull request a cloud session opened; between them, "The Framework merged this agent's pull request" is a fact on the record.

#### Business logic

An agent [1] whose recorded merge outcome is that its pull request was merged reads "merged". Any other merge outcome — armed for GitHub to merge, watched for green checks, withheld, or failed — is not "merged" and falls through to the rules below.

### A recorded pull request means the work landed

#### Context

**Problem**: a pull request's live state (open, closed, checks red or green) is not on the agent's record; it is read live wherever the pull request badge is shown. A cloud word that tried to describe it would be stale.

#### Business logic

Once a pull request is recorded on the agent [1] — the session's own, or the one cloud work adoption [8] opened — the word is "done": the work left the cloud session [3] and landed on a branch, exactly as a finished local agent with a pull request reads. What is happening to that pull request is the pull request badge's job to say.

### Inside the session window, still in the cloud

#### Context

**Problem**: nothing tells this machine when a cloud session [3] finishes. The only bound available is time, and it must match the window in which the bridge [4] still watches sessions (`dashboard/bridge-sessions.ts`): past that window nothing can learn that a session is parked, so "in cloud" would be a guess nobody could ever correct.

#### Business logic

With no pull request and no merge recorded, an agent [1] that started no more than 12 hours ago reads "in cloud": its cloud session [3] may still be working. An agent older than that reads "done" — either the session finished without ever pushing, or it never will. An agent whose recorded start time cannot be read also reads "done", so an unreadable record never claims work is in flight.

### What still counts as an agent at work

#### Context

**User story**: the Overview [7] lists the agents at work across every project. A web agent whose checkout is already gone but whose cloud session is still working belongs on that list; one that is over does not.

#### Business logic

"waiting" and "in cloud" count as an agent [1] still at work: the cloud session [3] is working, or is owed an answer from a human. "merged" and "done", and having no cloud word at all, do not.
