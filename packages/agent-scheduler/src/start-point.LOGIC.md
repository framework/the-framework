The start point [1] of a scheduled run [2], brought up to date the way a run's checkout [3] is, and whether a file is on it. The tick [4] asks here whether a command's [5] skill's file is on the start point, only for a command it is about to start a run for, and starts none when the file is not there.

## Context

**User story**: a person writes a new skill with a `schedule` in their own checkout of the project. Its command is listed on the Automations page at the next tick, and the person switches it on before the skill is on origin's default branch. When the command is next due, no agent starts for it. The page row says "Cannot start yet: its skill is not on origin/main", and the state says `not on origin/main: a run's checkout starts from origin/main, and the command's skill is not there`. Once the skill is on origin's default branch, pushed from this machine or brought there by another one, the command starts like any other.

**Business logic story**: the schedule [6] is read from the skill files as they are on disk in the person's own checkout (`schedule.ts`). A run does not work there: `agent-runner` gives it a fresh checkout [3], made through the `branches` package from origin's default branch, fetched first, or, in a repository with no remote, from the commit the person's own checkout is on. So a skill that is on disk and not on the start point schedules a command that no run's checkout holds. This file reads the start point and says whether a file is on it; when the question is asked, and the line that says why a command did not start, is the tick's (`tick.ts`).

**Problem**: the coding agent's harness expands a slash command only from a skill in the run's checkout. A run started for a command whose skill is not there is an agent told a command it does not know, and one more such agent every time the command is due.

**Problem**: bringing the start point up to date is a fetch, which reaches the network, and a tick runs every minute. It must be paid only by a tick that is about to start a run, once however many runs that tick starts, and it must not hold a tick up while the machine is offline.

## Glossary

[1] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[2] run: one agent the scheduler starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[5] command: a scheduled command, one command a skill schedules: the skill's folder name and at most one word the skill takes as its argument (`triage quick`).
[6] the schedule: all the scheduled commands of a project. A skill of the project brings its own with the `schedule` key in the front matter of its `SKILL.md`, called the skill's `schedule`.

## Business logic — TL;DR

- **The start point, brought up to date** - origin's default branch as this clone names it (`origin/main`), fetched from origin first, waited for 5 seconds at most; the answer says whether origin was reached, and when it was not, the commit is the copy this clone last saw. In a repository with no remote: `HEAD`, nothing fetched, and it counts as reached.
- **One tick's question** - "is this file on the start point": the start point is read, and so fetched, the first time a tick asks and once only; each answer carries the start point's name, whether origin was reached, and whether the file is there.
- **Whether a file is on a commit** - as a checkout of that commit would have it: the path is walked down the commit from the repository root, and a link met on the way is followed like the file system follows it (a link to the skill's folder, a link for the whole skills folder, a link to the file), through 8 links at most. A link whose target is not on the commit, that leaves the repository, or that turns in a circle leads nowhere; a folder without the file, and a submodule on the way, are not there.
- **A commit that cannot be read** - nothing can be said, so the question counts the file as there and no command is held back.

## Business logic

### The start point, brought up to date

#### Context

**User story**: a teammate merges a new scheduled skill on their machine, or takes one off. The scheduler on this machine must decide by origin's default branch as it is now, the same commit the run's own checkout will be made from, not by the copy this clone fetched yesterday.

#### Business logic

The start point [1] is named the way git names it. In a repository whose clone knows origin's default branch, it is that branch as the clone's remote-tracking branch (`origin/main`), found by the `agent-data` package's rule: the branch origin's `HEAD` points at, else `origin/main`, else `origin/master`, whichever the clone has. That branch alone is then fetched from origin, the same fetch the `branches` package makes before it creates a run's checkout. The fetch is waited for 5 seconds at most (`names.ts`), the wait a run's own checkout gives it. The answer is the name and whether origin was reached: reached when the fetch succeeded within the wait; not reached when it failed, as on a machine that is offline, or ran longer. Not reached, the commit under the name is the copy this clone last saw. A fetch still running after the 5 seconds is not stopped and finishes on its own.

In a repository with none of those branches (no remote, or one never fetched), the start point is `HEAD`: the commit the person's own checkout is on, which is where git starts a run's checkout there. Nothing is fetched, and the answer says reached. A failure to read origin's default branch counts as having none.

### One tick's question

#### Context

See the second problem in `## Context`.

#### Business logic

For one tick, the wiring (`scheduler.ts`) makes one question: given a file's path from the repository root, is it on the start point. The first time the question is asked in a tick, the start point is read as above, fetch included; every later question of the same tick uses that reading, so a tick that is about to start three runs fetches once. A tick that asks nothing reads nothing and fetches nothing. The next tick makes a new question and reads the start point again.

Each answer carries the start point's name (`origin/main`, `HEAD`), whether origin was reached, and whether the file is there (below).

### Whether a file is on a commit

#### Context

**Problem**: a project keeps a skill in the folder its coding agent reads it from, often as one copy under `.agents/skills` with a link to it under `.claude/skills`; a project may also make the whole `.claude/skills` folder a link. Git records a link as a link, not as what it points at, so looking the path up in the commit as written would say a linked skill is not there, while a checkout of the commit has it.

**Problem**: the folder of a skill being on the commit does not make the skill a command there: the coding agent's harness needs the skill's file, `SKILL.md`.

#### Business logic

A file is on a commit when a checkout of that commit would have a file at that path. The path is walked from the repository root, one name at a time, each name looked up in the commit exactly as written, never as a pattern:

- A name the commit does not have at that place: the file is not there.
- A folder, with more of the path to go: the walk goes on inside it.
- A file as the last name of the path: the file is there. A folder as the last name is not a file: the file is not there, so a skill's folder without its `SKILL.md` is not there.
- A file, or a submodule, with more of the path to go: a checkout has nothing below it, and the file is not there.
- A link: its target, as the commit records it, is read relative to the folder the link is in, the rest of the path is put after it, and the walk starts again from the repository root with that new path. A link with an empty target, a target that is an absolute path, or a target that climbs out of the repository leads nowhere: the file is not there.

So `.claude/skills/plan/SKILL.md` is there when `.claude/skills/plan` is a link to `../../.agents/skills/plan` and the commit holds `.agents/skills/plan/SKILL.md`; when `.claude/skills` itself is a link to `../.agents/skills`; and when `.claude/skills/plan/SKILL.md` is a link to the file. A link whose target is not on the commit ends at a name the commit does not have. A path may go through 8 links; one that meets a ninth, as two links pointing at each other do, is not there.

### A commit that cannot be read

#### Context

**Problem**: a repository with no commit yet, or a clone whose copy of origin's default branch does not resolve, cannot say what a run's checkout would hold. Holding every command back on that ground would stop a scheduler for a reason no skill's author can fix.

#### Business logic

Before the walk, git is asked whether the start point's name resolves to a commit. When it does not, whether the file is on the commit has no answer, neither yes nor no. One tick's question then counts the file as there: the command is not held back, and its run says itself what is wrong with its checkout.
