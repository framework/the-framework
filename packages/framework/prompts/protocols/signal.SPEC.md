Pins how an agent reports on itself without stopping: the three blocks it emits mid-turn to declare the work ready for merge, dictate the pull request The Framework opens for it, and report something only the user can fix. The session name is not among them: the agent names its branch with the branch-management skill's command, and The Framework reads the name off the branch.

## User story

- The user watches a list of running agents. Each one has to say when it is done, or the list is unreadable.
- The user reviews finished work as a pull request. Its title and description should say what the work turned out to be, not repeat the prompt the agent was given.
- The user wants to be told when an agent is blocked on something only they can fix — a missing file, a command that will not run, a login it does not have — without having to read the whole log to find it.

## Business logic — TL;DR

- **Every signal is non-blocking** - each block is emitted mid-turn and the agent keeps working; stopping to ask is the await protocol's job, not this one's.
- **Ready for merge** - an empty block flipping the agent from building to ready for human review.
- **The agent dictates its pull request** - a block naming and describing the work, written like a commit message; The Framework opens the pull request, so the agent does not have to.
- **The Framework fills in what must be consistent** - the ticket's issue reference and recording the pull request number, so every surface shows the same pull request.
- **Errors are reported, once** - a block whose first line is the headline and whose body is the detail; it is marked in the agent's event log and counted on the agent, and an identical repeat is ignored.

## Business logic

### Ready for merge

#### User story

See `## User story`: the user needs to know when an agent believes it is done.

#### Business logic

When the agent calls `setReadyForMerge()` — meaning it believes the work is complete and ready for human review — it emits an empty `ready-for-merge` block. This flips the dashboard's status for the agent from building to ready; it does not stop the turn.

### The agent dictates its pull request

#### User story

See `## User story`: a pull request titled with the prompt says what was asked for, not what was done.

#### Business logic

Whenever the agent emits `ready-for-merge` it also emits an `open-pr` block naming and describing the work, and The Framework opens the pull request from it — the agent does not need to run a GitHub command itself. The block is written like a commit message: the first line is the title, under 100 characters, and everything after it is the body, in markdown, as long as it needs to be.

The prompt states what is lost without it: the pull request then has no name for the work and can only repeat the prompt the agent was given, which does not say what the work turned out to be.

The agent does not stop on it and may re-emit it as the work changes; the last one is used. Opening the pull request itself instead is still allowed — the agent then owns everything The Framework would otherwise have supplied.

### The Framework fills in what must be consistent

#### User story

The user follows one piece of work across the dashboard, the ticket it came from, and GitHub.

#### Business logic

The agent writes the title and the description; The Framework supplies the parts that have to line up — the ticket's issue reference where there is one, and recording the pull request's number so that every surface shows the same pull request.

### Errors are reported, once

#### User story

See `## User story`: the user wants blockers surfaced without reading the log.

#### Business logic

When the agent hits something only the user can fix — a missing file it was told to read, a command that will not run, a login it does not have — it emits an `error` block: first line the headline, anything below it the detail of what it ran and what that said. It then carries on or stops as the task requires.

The Framework marks the error in the agent's event log and counts it on the agent, so the user sees it without reading the whole log. The block does not stop the turn and it does not ask the user anything — a question is a gate, per the await protocol. The agent reports the same thing once: an identical block re-emitted later is ignored.

#### Rationale

Ignoring identical repeats matters because agents restate their blocks turn after turn; without it one failure would read as many.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
