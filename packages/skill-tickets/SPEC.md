Tickets and the agent queue for coding agents, as an npm package: markdown tickets with their plans and their claims, and the priority-banded list of what agents work on next — all of it on the `agent-data` branch of the project's own repository, never on a code branch; the `tickets` command that reads and changes them from any clone; and the instructions an agent follows to use them (`SKILL.md`).

The package knows git, the filesystem and the ticket format, nothing else. The same functions serve every caller: a long-lived process (a daemon that starts agents, a dashboard that lists the roadmap) that keeps a checkout of the branch, reads the tickets and claims them for the agents it starts, and an agent's own shell, through the `tickets` command a caller puts on the PATH of every agent it starts on its machine. What a caller knows beyond git — which agent it started, whether that agent ended with nothing, which ticket it wants planned next — is passed in; the package never reads a caller's records.

The branch is a file store, the primitive `@gemstack/agent-data` provides: a branch nobody edits in a working tree, safe to push and pull eagerly. It gives this package two writers over one rule. A long-lived process writes through its persistent checkout, `.branches/agent-data`, in one serialized cycle per branch — sync with origin, apply, commit, push — and pulls the same way so it reads what other machines pushed. The `tickets` command writes as a one-shot remote writer instead: a throwaway checkout of origin's tip, one commit, pushed straight to the branch, gone afterwards — so a command an agent runs never touches a checkout that belongs to another process. Both treat a change as an intent: a push that loses a race is re-applied against the fresher state rather than forced.

## Glossary

- **holder** - who a claim on a ticket names: the agent, cloud session or person that is planning or working it. Read from where the command runs (`holder`), never typed.
- **the funnel** - a caller's write cycle over the branch: apply a change to a checkout of it, commit, push. A long-lived process passes its own; the package's default is the persistent checkout's cycle.

## Business logic — TL;DR

- **The conventions** (`names`) - the shared data branch `agent-data` (`@gemstack/agent-data` names it), its persistent checkout `.branches/agent-data`, the `tickets/` folder, the queue file `TODO_AGENTS.md`, the `meta.json` stamp; how a ticket's filename names its plan and its claim; the gates every filename arriving from outside passes; the ticket a queue entry links back to; the queue section a ticket's own priority earns it; the issue a ticket tracks.
- **What a ticket says** (`tickets`) - the read side: a ticket's head — title, TLDR, priority, topics, the issue link, its date — plus what the plan and the claim beside it add. Reads through a small filesystem seam, so the same reader serves a checkout on disk and a branch read straight off git.
- **The claim** (`locks`) - one holder at a time per ticket, as a `.lock.md` file beside it reading `CLAIMED: <holder>`; claimed for a batch of tickets or one, released by its holder or by a caller cleaning up; no timed release.
- **The queue** (`queue`) - `TODO_AGENTS.md`: the open entries in order of work, an entry added into its `## Priority N` section, an entry taken off by deletion — done means gone, not checked off.
- **Who claims** (`holder`) - the identity a claim is made under, read from where the command runs: `AGENT_ID` from the environment when the process that started the agent set it, else the current branch name; a detached checkout has none.
- **Where it all lives** (`store`) - the branch bound to a project: the persistent checkout's paths, the seams every operation is injected with, and the sync that makes the branch, seeds the queue, links `tickets` at the repository root hidden from git, and converges with origin.
- **The command line** (`cli`, `bin/`) - the same operations as commands for a shell: JSON on stdout, a reason on stderr, an exit code that tells a refusal from a usage error; the executable's directory and the skill's own directory are exported (`bin-dir`) for a caller that spawns agents.
- **The skill** (`SKILL.md`) - what the agent is told: the tickets are on a branch and not in its checkout, the `tickets` command is how it reads and changes them, it claims a ticket before planning or working it and backs off from someone else's claim, and the formats a ticket, a plan and the queue are written in.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
