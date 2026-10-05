Reads the git facts of the checkout [1] in play and keeps them current: for an agent [2], that agent's branch, its pull request, and its checkout (path, clean or dirty, size on disk) while it has one; with no agent, the project's own checkout (branch, clean or dirty, pull request). It is the one read behind the line of git facts (`components/GitStatusBar.tsx`) and behind the two bars of an agent's page (`components/AgentView.tsx`).

## Context

**User story**: an agent commits, renames its branch and opens a pull request while the user watches its page; the page says so within seconds, without a reload.

**Problem**: an agent's page shows these facts in two places, the action bar at its top and the bar above the message box. Read by each place for itself, the two could disagree for a moment and the daemon was asked twice. The page reads once, here, and hands the answer to both.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Whose checkout** - with an agent named, the daemon is asked about that agent's checkout; with none, about the project's own.
- **Kept current** - read again every 10 seconds, or every 0.3 seconds while the daemon's pull request lookup is still out.
- **Read again when a turn starts or ends** - the caller says whether the agent's turn is going; when that changes, the checkout is read at once, not at the next poll.
- **Remembered per checkout** - going back to a checkout seen before gives what was read last time at once, while it is read again; a checkout never seen gives no answer until its own is in.
- **Switched off** - a caller that already has the answer asks for nothing to be read.

## Business logic

### Whose checkout

#### Context

See `## Context`.

#### Business logic

With an agent's [2] id, the daemon is asked where that agent is working (the answer is the daemon's, `../../src/dashboard-rpc/reads.ts`): its branch, its pull request, and its checkout [1] while it has one. Without an agent's id, the daemon is asked for the project's git status: its branch, whether it is dirty, its pull request. The answer is "no answer" until the read has answered for this checkout, and stays "no answer" when the daemon has nothing to report (no repository, no such agent).

### Kept current

#### Context

**Problem**: the daemon's pull request lookup, while still out, answers within a second. Waiting ten seconds for the next read would leave a gap where the pull request link goes.

#### Business logic

The read is made again every 10 seconds. While the last answer says the pull request lookup is still out, it is made again every 0.3 seconds, and goes back to every 10 seconds once the lookup has answered. A read that fails keeps the last answer (`use-async.ts`).

### Remembered per checkout

#### Context

**Problem**: after a switch from one agent to another, the previous agent's branch under the new agent's name reads as the new agent's own, for the moment the read takes.

#### Business logic

Each answer is remembered under its own checkout (each agent's, and each project's own) for as long as the page is open (`use-async.ts`). On a switch, a checkout seen before gives its remembered answer from the first frame, and the read is made again at once, so the fresh answer replaces it when it lands. A checkout never seen gives no answer until its own read lands: never the previous one's.

### Switched off

#### Context

See the problem in `## Context`.

#### Business logic

The caller can switch the read off. Nothing is asked of the daemon then, and the answer is "no answer". The line of git facts does this when its caller hands it the checkout already read (`components/GitStatusBar.tsx`).

### Read again when a turn starts or ends

#### Context

**Problem**: an agent's turn ends and its checkout is clean or dirty from that moment. Read only on the 10 second poll, the page knew it up to 10 seconds late: the bar above the message box, drawn when the checkout holds uncommitted changes, came after the agent had long said it was done.

#### Business logic

The caller can say whether the agent's turn is going (the agent's page does, from the events it shows). When that changes, from going to ended or from ended to going, the checkout is read again at once. Nothing more is read on the first render or when the page turns to another checkout: the poll reads then already.
