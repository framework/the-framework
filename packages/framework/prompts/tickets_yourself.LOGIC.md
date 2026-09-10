The counterpart of `branch_yourself.md` for the tickets and the agent queue [3]: what an agent [1] running outside a checkout [2] The Framework created is told when the `tickets` and `queue` commands are not on its PATH, so that it reads and writes the `agent-data` branch [4] with git itself, exactly as the commands would, and claims a ticket without ever taking one another agent holds. The composition rule in `src/system-prompt.ts` places it after `branch_yourself.md` and follows it with the `tickets`, `queue` and `logs` skills' [5] own `SKILL.md`, which give the file formats; an agent in its own checkout gets the skills themselves instead. The prompts README calls this file temporary: it goes when the skills are committed into the repository.

## Context

**User story**: an agent [1] on a GitHub Actions runner or in a cloud session works a ticket like any other agent: it reads the queue and the ticket, claims the ticket so no other agent takes it, and updates the queue when its instructions say so, and none of that bookkeeping ever lands on the agent's code branch or in the pull request.

**Problem**: the shared bookkeeping lives on the `agent-data` branch [4], and the commands that keep two agents from stepping on each other are not installed on a runner or in a cloud session; without these instructions such an agent would edit the files on its own branch, switch its checkout to the `agent-data` branch, or overwrite another agent's claim [6].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[5] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[6] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[7] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **Read from the remote branch** - fetch `origin/agent-data` and read a file straight out of it, never by switching to the branch.
- **Write on a detached checkout and push straight to the branch** - only when the instructions say to change tickets or the queue; a rejected push is fetched, rebased and pushed again; the files never go on the agent's own branch.
- **Claim a ticket with a lock file, and back off when beaten** - the claim is a lock file naming the holder; when its push is rejected because the file now exists, another agent claimed first, and the agent picks another ticket instead of touching that lock.

## Business logic

### Read from the remote branch

#### Context

See `## Context`.

#### Business logic

To read a ticket or the agent queue [3], the agent [1] fetches the `agent-data` branch [4] from the remote and shows the file out of it, for instance `origin/agent-data:TODO_AGENTS.md` or `origin/agent-data:tickets/<DATE>_<SLUG>.md`. The agent's own checkout [2] is never switched to that branch.

### Write on a detached checkout and push straight to the branch

#### Context

**Problem**: the `agent-data` branch [4] is written by many agents at once, so a write is a race; the commands resolve it by rebasing on the remote and pushing again, and an agent without them has to do the same by hand.

#### Business logic

The agent [1] writes to the tickets or the agent queue [3] only when its instructions say to change them. A write is a commit on a detached checkout of the remote branch (a separate git worktree added at `origin/agent-data`), pushed straight to the branch. When the push is rejected, the agent fetches, rebases and pushes again. Two things are never done: switching the agent's own checkout [2] to the `agent-data` branch [4], and putting any of these files on the agent's own branch.

### Claim a ticket with a lock file, and back off when beaten

#### Context

**Problem**: two agents that pick the same ticket at the same time both push a claim [6]; git accepts only the first push, which is what makes the lock file a claim, but only if the loser respects it.

#### Business logic

A ticket is claimed by adding `tickets/<DATE>_<SLUG>.lock.md` beside it, holding `CLAIMED: <holder>`. The holder [7] is `AGENT_ID` when the agent's environment has it, else the agent's branch name. When the push of the lock is rejected because that file now exists, someone else claimed the ticket first: the agent [1] backs off and picks another ticket, and never removes or overwrites the other agent's lock.
