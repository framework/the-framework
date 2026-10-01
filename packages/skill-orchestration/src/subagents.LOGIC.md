A main agent [1] and its subagents [2]: saving and showing the main agent's plan [8], starting a subagent on a task once the person approved that plan, listing the main agent's subagents, reading one's result, stopping one, and landing one's work on the main agent's branch. Each is a short read or write of what the runner (`agent-runner`) keeps: a subagent is a run [3] of the runner's, started for the calling run. Nothing here waits for a subagent: the runner tells the main agent when one ends.

## Context

**User story**: the user asks one agent for a piece of work it splits up. That agent starts other agents on the parts, ends its turn, and goes on each time one of them ends; it can see which it started and how each stands, read what one answered, and stop one that is no longer needed.

**Business logic story**: the runner starts a run for another run (`agent-runner run --parent <id> --base <ref>`), keeps the parent on the run's record in the tool's mark [5], and tells the parent when the run ends (`agent-runner`'s `parent.ts`). This file is the caller of that: it fills in the parent and the base from the calling run, and reads the runs back by their parent.

**Problem**: an agent that starts another agent by the runner's own command line must name its own run and its own branch and can get either wrong; the runs it started are told apart from every other run only by the tool's mark [5], which no command prints to an agent; and stopping one needs the pid of its process, which sits in another checkout.

## Glossary

[1] main agent: the run [3] whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[2] subagent: a run [3] started for a main agent: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as `parent` in the tool's mark [5].
[3] run: one agent the runner starts: a process of the runner's, a checkout, one prompt to the coding agent, and a run record [4] when it ends.
[4] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`), written as `running` before the agent exists and again when the run ends.
[5] the tool's mark: `caller.runner` on a card, the runner's own bookkeeping: `host`, the machine that started the run; `pid`, the run's process there while it runs; `parent`, the run this one was started for.
[6] live card: the card `<id>.json` under `.the-framework/` in a run's checkout, kept by the session while the agent works; carries the tool's mark with the run's pid.
[7] the subagent lines: the fixed text the command adds after every subagent's task: `You are a subagent: another agent started you for this one task and reads your last reply as its result. Commit your work to your branch and do not open a pull request. Nobody will answer a question: decide yourself, and say in your last reply what you did and what you decided.`
[8] plan: the main agent's list of tasks for its subagents, one markdown file beside its run record [4] on the `agent-data` branch; approved when the person answered `Approve` to the question that names it (`plan.ts`).
[9] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the only branches the product deletes.

## Business logic — TL;DR

- **Who is calling** - the main agent [1] is the run `AGENT_ID` names, known by its run record [4] or else by the live card [6] in its checkout; with `AGENT_ID` unset or empty, or naming a run with neither, every operation is refused `not-a-run`.
- **The plan** - saved as the caller's plan [8] and answered with the question to ask the person; shown with that question and whether the person approved it; a subagent has none (`subagent`), and showing with none saved is refused `no-plan`.
- **Starting a subagent** - refused `no-plan` until a plan is saved and `not-approved` until the person approved the plan as it is saved now; then a run whose record is written first and whose process is then started detached, answered with its id without waiting for it: the main agent as its parent, its branch started from the branch the main agent's checkout is on, its prompt the task followed by the subagent lines [7], on the main agent's coding agent unless one is named, on the model named or else the coding agent's default. Refused `subagent` when the caller is itself a subagent, `no-branch` when the caller has no checkout of its own or it is on no branch, `not-ready` when the coding agent cannot start on this machine. Uncommitted changes in the caller's checkout are answered as `uncommitted: true`, and the subagent still starts.
- **Listing** - every run record whose mark names the caller as parent, newest first, each as the card without the runner's bookkeeping and with the task in place of the whole prompt.
- **Reading one** - the same card for one subagent, plus `result`: the agent's final answer of its last turn, once the run record holds one. A run that is not the caller's subagent, or no run at all, is refused `not-yours`.
- **Landing one** - an ended subagent's branch merged into the branch the caller's checkout is on, then, for an agent branch [9], deleted here and on origin and taken off the subagent's record, its leftover checkout removed. Refused `running`, `nothing-to-land`, `uncommitted`, `uncommitted-there`, and `conflict` with the files, the merge undone; nothing is deleted before the merge is in.
- **Stopping one** - SIGTERM to the process the subagent's live card [6] names. Refused `not-yours`; `not-running` when its record says it ended; `other-machine` when its record names another machine; `no-process` when its checkout holds no running live card or the pid on it is not alive.

## Business logic

### Who is calling

#### Context

**Problem**: an agent must never be asked for its own run's id, and a person in a plain shell, or an agent some other program started, has no run to hang subagents on.

#### Business logic

The caller's id is `AGENT_ID` in its environment, trimmed. Unset or empty, the operation is refused `not-a-run` with `AGENT_ID is not set: only an agent started as a run has subagents; do the task yourself`. The caller is then the run record [4] with that id; when the project has none, the live card [6] in that run's checkout (`.branches/agent-<id>` under the project), which is there from before the agent's first turn, while a run's first record may still be on its way to the branch. With neither, the operation is refused `not-a-run` with the id and `no run <id> in this project: only an agent started as a run has subagents; do the task yourself`.

### The plan

#### Context

**User story**: the main agent writes the plan of small tasks it worked out with the user to a file and saves it; the command answers the question to put to the user, who approves the plan before any subagent starts.

#### Business logic

Saving takes the plan's text. A caller that is itself a subagent [2] is refused `subagent`, `a subagent has no plan: do the task yourself`. The text is saved as the caller's plan [8], over the one it had (`plan.ts`), and the answer is the `question` that names that text: the one to ask the person.

Showing answers the caller's saved `plan`, its `question`, and `approved`: whether the person approved the plan as it is saved. With no plan saved it is refused `no-plan`.

### Starting a subagent

#### Context

**User story**: the main agent gives a task in its own words; the subagent works it alone on a branch that already holds the main agent's commits, leaves its work committed there, opens no pull request and stops on no question, since nobody is there to answer it.

**Problem**: a main agent that had to write those rules into every task would forget one; a subagent that started subagents would make a tree nobody reads; a subagent started on a coding agent other than the main agent's could fail on a machine where only the main agent's is installed; and an id answered before the run has a record is one the other commands would refuse for the seconds the record takes to be written.

#### Business logic

In order:

1. The caller's own record must not name a parent in the tool's mark [5]: a caller that is a subagent [2] is refused `subagent`, `a subagent starts no subagents: do the task yourself`.
2. The base is the branch checked out in the caller's checkout (`.branches/agent-<the caller's id>` under the project), read at that moment, so a branch the agent renamed is followed. A directory that is not the root of a checkout of its own, or a checkout on no branch, is refused `no-branch`: the project's own branch is never taken for the caller's.
3. The coding agent is the one named; else the one the caller's record names, when it is one the runner can start; else Claude Code.
4. The runner is asked whether that coding agent can start on this machine; any problem refuses `not-ready`, answered with the problems and the warnings, the problems as the line for a person.
5. The caller's plan [8] is read. With none saved: refused `no-plan`, the line saying to save one with `orchestration plan <file>` and ask the person first. With one the person has not approved as it is saved now (`plan.ts`): refused `not-approved`, answered with the `question`, the line saying to ask the person that question with the option `Approve`, end the reply there, and start once they chose it.
6. Whether the caller's checkout holds uncommitted changes is read; a read that fails counts as none.
7. The subagent's id is minted from the current time, as the runner mints a run's. Its run record [4] is written as `running`, with an empty diary: the prompt (the task, an empty line, then the subagent lines [7]) as the intent, the coding agent of step 3, the model only when one was named, and the tool's mark [5] naming this machine, the caller as `parent` and the branch of step 2 as `base`; the record also names the caller beside the machine, as `caller.parent`, where a reader that does not know the tool's mark, such as a dashboard, finds it. A record that could not be committed at all fails the command; one committed but not pushed goes on.
8. The runner's process for that run is spawned detached with the same id, prompt, coding agent, model, parent and base, and writes no first record of its own, as for a run a scheduler starts. When the process cannot be spawned, the record is taken back and the command fails.

The answer is the subagent's `id`, its `driver`, its `model` when one was named, `base`, and `uncommitted: true` when step 6 found changes.

### Listing

#### Context

See `## Context`.

#### Business logic

Every run record of the project whose mark [5] names the caller as `parent`, newest first. Each is the card's own fields (`id`, `startedAt`, `endedAt`, `status`, `intent`, `driver`, `model`, `branch`, `pr`, `cost`, each only when the card has it) and never `caller`. `intent` is the task: the prompt with the subagent lines [7] and the white space before them taken off its end, or the prompt unchanged when it does not end with them. A subagent is listed from the moment `start` answered its id. While it runs, its card has no `branch`.

### Reading one

#### Context

**User story**: the main agent is told a subagent ended with its last words in the message; later in the same work, or after its conversation was shortened, it reads the result again by the subagent's id.

#### Business logic

The id must name a run record whose mark names the caller as `parent`; anything else, a run of somebody else's or no run, is refused `not-yours`, `<id> is not a subagent of this run`. The answer is the card as in the listing, plus `result`: the text of the last `result` line of the recorded diary, the agent's final answer for its last turn. A subagent on its first turn has no recorded diary yet, so no `result`; one that ended and was continued answers `status: running` beside the `result` of its earlier turn until it ends again.

### Landing one

#### Context

**User story**: a subagent ended and its work is on its own branch; the main agent takes it onto its own branch, the one the single pull request is opened from, and the subagent's branch disappears, so the project's branches show one branch for the whole plan.

**Problem**: a subagent's branch left on origin after its work was merged is more than a leftover: when the main agent's branch only moved forward to that branch's tip, the runner finds the main agent's branch holding nothing origin lacks under another name, deletes it with the checkout at the end of the turn, and the next turn starts on a new branch without the landed work. A merge an agent runs by hand also leaves the deleting to its memory.

#### Business logic

The id must name one of the caller's subagents (`not-yours` otherwise). Then, in order:

1. A subagent whose record says `running` is refused `running`: it is landed once it has ended, however it ended.
2. A record that names no branch is refused `nothing-to-land`: the subagent committed nothing, or it is landed already.
3. The caller's checkout must hold no uncommitted change, else refused `uncommitted`.
4. When the subagent's own checkout is still on disk (a subagent that ended `waiting`, or whose checkout the runner could not reclaim) and holds uncommitted changes, refused `uncommitted-there` with the checkout's `path`: that work is committed there first.
5. The subagent's branch is fetched from origin, a failure ignored. The branch as this clone has it is used, else origin's copy; gone in both, refused `nothing-to-land`.
6. When the caller's branch already contains that branch's tip (the main agent merged it by hand), nothing is merged. Otherwise it is merged into the branch the caller's checkout is on, fast-forwarding when it can, else as a merge commit with the message `Merge branch '<branch>'`. A merge that stops on conflicts is undone, leaving the caller's checkout as it was, and refused `conflict` with the subagent's `id`, the `branch` and the conflicting `files`; the line names the `git merge` to run by hand, after which landing again finds the tip contained. A merge that fails for another reason fails the command.
7. Only when the branch is an agent branch [9]: the subagent's leftover checkout is removed, the branch is deleted in this clone and on origin (a branch origin no longer has counts as deleted), and the subagent's run record [4] is written again without `branch`, so it names no branch that is gone. A branch under any other name is merged and kept, and stays on the record.

The answer is the subagent's `id`, the `branch`, and `merged`: true when step 6 merged, false when the work was already in.

### Stopping one

#### Context

**Business logic story**: a run stops on SIGTERM to its process: the runner ends the agent's process tree, records the run `stopped`, reclaims its checkout, and tells the parent as for any other end. The pid is on the live card [6] in the run's checkout.

**Problem**: a pid read from a record of another machine, or from a card of a run that has ended, could be any process on this one.

#### Business logic

After the `not-yours` check, in order:

1. The run record says anything but `running`: refused `not-running`, with the status, `<id> is not running: it ended <status>`.
2. The record's mark names another machine than this one: refused `other-machine`.
3. The live card [6] in the subagent's checkout must say `running` and carry a pid that is a live process here; otherwise refused `no-process`, `<id> has no process to stop yet, or its process died: look again in a moment` (a run whose process is still starting has no live card yet; one whose process died stays `running` on its record until the runner's sweep records it `failed`).
4. SIGTERM is sent to that pid, and the subagent's id is answered. The command does not wait for the run to end.
