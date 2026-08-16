The daemon's serving and projection layer: the HTTP host behind the dashboard, the read models it assembles from disk and git, the git handoff (push → PR → merge), and the notification watchers.

## TLDR

- Everything the dashboard shows is assembled here from what is already on disk — agent logs, tickets, the queue, git state, GitHub state. Reads are forgiving: whatever fails yields an empty result, never a crash at the view.
- Serving is guarded by where the daemon is bound: on localhost, browser calls must come from the dashboard's own origin; on a reachable address, everything demands a shared token, because a daemon that spawns processes on an open port is remote code execution.
- Expensive questions (a GitHub lookup costs many times a git read) go through a cache that asks once for all concurrent callers, serves the last good answer while refreshing, and answers "pending" — not "failed" — when a cold ask exceeds its time budget, so a caller that must not act on a half-answer can hold off. A failure never overwrites the last good value.

## Flows

**The handoff.** When an agent settles cleanly, decide whether it is empty (no commits, or only bookkeeping changes) — empty agents are never published. Otherwise commit what it left uncommitted, push the branch, open the PR. The PR number is then recorded on the agent, so every surface reads the same integer instead of re-deriving it from three candidate branch names filtered by a start time; its *state* is still read live, because that changes without the agent doing anything. A PR opened after the process is gone is recorded too, by patching the archive.

**Merging.** Arming and authorizing are separate: configuration arms auto-merge, and only the agent's ready-for-merge signal plus an empty backlog of its own authorizes it — an armed-but-unauthorized merge is recorded as withheld, with the reason. On a repo without native auto-merge the PR is handed to the CI watch to merge once checks pass, and the merge outcome lands on the agent's record so every surface can say what happened.

**Watchers.** Two Discord notification watchers — activity (agents started and finished) and interventions (an open PR to review, an agent parked on a question, a finished agent whose commits were never pushed) — each remembering what it already announced, so only new items post. Outbound only: Discord is a way for the product to reach the user, never a way to steer it. The first look only takes a baseline, and the cursor keeps advancing while notifications are off: turning them on starts from now instead of flushing a backlog. The open-questions hub gathers every parked question across all agents, with its full options read back from each one's own log.

**Remote devices.** The local daemon — never the browser — talks to a saved device's daemon: it starts the agent there and streams the events back over the browser's normal same-origin channel; agent-scoped calls are forwarded the same way, with the device side accepting only an allowlisted set (reads and steering — starting and deleting are deliberately not remotable this way). An unreachable device answers like any failed local read: empty.

**The cloud-session bridge.** A browser extension inside the user's own claude.ai tab posts parked questions in; picked answers queue back out for the extension to type into the cloud composer. The payload is tiny and fully validated — no paths, no commands, no free text — so the worst a stolen token buys is a bogus question card.

**The live browser.** The dashboard cannot reach an agent's Chrome directly (wrong origin), so the daemon proxies the screencast and the clicks — and the port comes from the agent's own record, never from the client, which is what keeps the proxy from being an open relay into anything else on the machine.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
