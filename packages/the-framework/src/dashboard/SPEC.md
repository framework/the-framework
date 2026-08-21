The daemon's serving and projection layer: the HTTP host behind the dashboard, the read models it assembles from disk and git, the git handoff (push → PR → merge), and the notification watchers.

## User Stories

- The user reviews finished work as pull requests: an agent that produced real work pushes it and opens a PR by itself, and a merge waits for the agent's own ready signal.
- The user is notified on Discord when an agent starts or finishes, and when something needs a human — an open PR to review, a parked question, unpushed commits.
- The user answers every agent's parked question from one hub, across all projects.
- The user runs an agent on a saved remote device and watches and steers it from the local dashboard.
- The user answers a cloud agent's question from the dashboard, and it is typed back into claude.ai.
- The user watches an agent's live browser and clicks into it from the dashboard.

## Flows — TL;DR

- Everything shown is assembled from what is already on disk; a failed read yields an empty result.
- Localhost serving demands the dashboard's own origin; a reachable bind demands a shared token on every route.
- Slow GitHub questions go through a cache: one lookup for all concurrent callers, the last good answer while refreshing, "pending" over a half-answer.
- A cleanly settled agent's work is committed, pushed and opened as a PR — unless it is empty, which is never published.
- Configuration arms auto-merge; only the agent's ready signal authorizes it, and a withheld merge is recorded with its reason.
- Two Discord watchers post only what is genuinely new: activity, and what needs a human.
- A saved device's agents are started and streamed through the local daemon, never the browser.
- A browser extension posts parked claude.ai questions in; answers the user picks queue back out.
- The daemon relays an agent's live browser screencast and clicks, on a port from the agent's own record.

## Flows

**The read models.** Everything the dashboard shows the user is assembled here from what is already on disk — agent logs, tickets, the queue, git state, GitHub state. A read that fails yields an empty result, never a crash at the view.

**Serving.** Serving is guarded by where the daemon is bound: on localhost, browser calls must come from the dashboard's own origin; on a reachable address, everything demands a shared token, because a daemon that spawns processes on an open port is remote code execution.

**The cache.** Expensive questions (a GitHub lookup costs many times a git read) go through a cache that asks once for all concurrent callers, serves the last good answer while refreshing, and answers "pending" — not "failed" — when a cold ask exceeds its time budget. "Pending" lets a caller that must not act on a half-answer hold off, and a failure never overwrites the last good value.

**The handoff.** When an agent settles cleanly, its work is measured first: an agent that produced nothing (no commits, or changes only to the framework's own records) is never published. Otherwise what it left uncommitted is committed, the branch is pushed, and the PR is opened. The PR number is then recorded on the agent, so every surface reads the same integer instead of re-deriving it; its *state* is still read live, because that changes without the agent doing anything. A PR opened after the process is gone is recorded too, by patching the agent's archived record.

**Merging.** Arming and authorizing are separate: configuration arms auto-merge, and only the agent's ready-for-merge signal plus an empty TODO backlog of the agent's own authorizes it. An armed-but-unauthorized merge is recorded as withheld, with the reason. On a repo without native auto-merge the PR is handed to the daemon's CI watch to merge once checks pass, and the merge outcome lands on the agent's record so every surface can say what happened.

**Watchers.** Two Discord notification watchers — activity (agents started and finished) and interventions (an open PR to review, an agent parked on a question, a finished agent whose commits were never pushed) — each remembering what it already announced, so only new items post. Outbound only: Discord is a way for the product to reach the user, never a way to steer it. The first look only takes a baseline, and the record of what has been seen keeps advancing while notifications are off: turning them on starts from now instead of flushing a backlog. The open-questions hub gathers every parked question across all agents, with its full options read back from each one's own log.

**Remote devices.** When the user starts an agent on a saved device, the local daemon — never the browser — talks to that device's daemon: it starts the agent there and streams the events back over the browser's normal same-origin channel. Agent-scoped calls are forwarded the same way, with the device side accepting only an allowlisted set (reads and steering — starting and deleting are deliberately not remotable this way). An unreachable device answers like any failed local read: empty.

**The cloud-session bridge.** A browser extension inside the user's own claude.ai tab posts parked questions in; answers the user picks queue back out for the extension to type into the cloud composer. The payload is tiny and fully validated — no paths, no commands, no free text — so the worst a stolen token buys is a bogus question card.

**The live browser.** The dashboard cannot reach an agent's Chrome directly (wrong origin), so the daemon proxies the screencast and the clicks. The port comes from the agent's own record, never from the client — which is what keeps the proxy from being an open relay into anything else on the machine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
