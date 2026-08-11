The daemon's serving and projection layer: the HTTP host behind the dashboard, the read models it assembles from disk and git, the git handoff (push → PR → merge), and the notification watchers.

## TLDR

- Everything the dashboard shows is assembled here from what is already on disk — session logs, tickets, the queue, git state, GitHub state — and whatever fails to read yields an empty result, never a crash at the view.
- Serving is guarded by where the daemon is bound: on localhost, browser calls must come from the dashboard's own origin; on a reachable address, everything demands a shared token.
- Expensive questions (GitHub ones cost hundreds of times a git read) go through a cache that asks once for all concurrent callers and serves the last good answer while refreshing.

## Flows

- **The handoff.** When a session settles cleanly, decide whether it is empty (no commits, or only bookkeeping changes) — empty sessions are never published. Otherwise commit what the agent left uncommitted, push the branch, open the PR. Every surface re-resolves the PR live from the session's recorded branch (falling back to the session-name and run-id branches), preferring an open PR.
- **Merging.** Configuration arms auto-merge; only the agent's ready-for-merge signal plus an empty session backlog authorizes it, and an armed-but-unauthorized merge is recorded as withheld, with the reason. On a repo without native auto-merge the PR is handed to the CI watch to merge once checks pass, and the merge outcome lands on the session so every surface can say what happened.
- **Watchers.** Two Discord notification watchers — activity (sessions started and finished) and interventions (an open PR to review, a session parked on a question, a finished session whose commits were never pushed) — each remembering what it already announced, so only new items post. The open-questions hub gathers every parked question across all sessions, with its full options read back from each session's own log.
- **Remote devices.** The local daemon — never the browser — talks to a saved device's daemon: it starts the session there and streams the events back over the browser's normal same-origin channel; session-scoped calls are forwarded the same way. An unreachable device answers like any failed local read: empty.
- **The cloud-session bridge.** A browser extension inside the user's own claude.ai tab posts parked questions in; picked answers queue back out for the extension to type into the cloud composer.
- **The live browser.** The dashboard cannot reach a session's Chrome directly (wrong origin), so the daemon proxies the screencast and the clicks.

## Rationales

- A daemon that spawns processes on an open port is remote code execution — that is why a non-local bind demands the token.
- The GitHub cache answers "pending" — not "failed" — when a cold ask exceeds its time budget, so a caller that must not act on a half-answer can hold off; a failure never overwrites the last good value.
- No PR number is ever stored, and a closed PR is accepted only if it was created after the session started — so a reused routine branch can't wear an old merged PR.
- A watcher's first look only takes a baseline, and the cursor keeps advancing while notifications are off: turning them on starts from now instead of flushing a backlog.
- The device side of remote forwarding accepts only an allowlisted set of calls — reads and steering; starting and deleting are deliberately not remotable this way.
- The bridge payload is tiny and fully validated — no paths, no commands, no free text — so the worst a stolen token buys is a bogus question card.
- The browser proxy takes the session's port from the session's own record, never from the client, which is what keeps the proxy from being an open relay into anything else on the machine.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
