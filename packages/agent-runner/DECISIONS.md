Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The tool
- A tool, a package with a command line, like `agent-driver`; not a skill. It runs one
  agent from start to end and nothing else: when an agent starts is the scheduler's call,
  or a person's.
- Standalone, beside `agent-driver`, not inside it. `agent-driver` depends on nothing; the
  runner needs git for its checkouts and its records, and inside the driver every user of
  the driver would get git and the skills with it. Either way was open; this one for now.
- The runner depends on `agent-driver` for the session and the readiness check, on the
  branches package for the checkout and the reclaim, on the logs package for the records,
  and on `agent-data` for the branch. It never depends on The Framework, and The Framework
  never depends on it.
- The runner names no skill and reads no schedule: a run is the prompt it is given.

## The record
- A run in flight is its run record, written on `agent-data` before the agent is spawned
  with `status: running` and the tool's mark, and written again at the end over the same
  file. Picked over a separate marker file the sweep would have to match up with a record:
  one file for the run's whole life, and every machine counts the same records.
- A running record from a machine that never comes back stays. Only the machine that wrote
  it, or a person, changes it. Picked over ageing it out after a fixed time, which could
  end a long run that is still working.

## The run
- One process per run, one-shot: `agent-runner run <prompt>` needs no scheduler, and the
  scheduler's tick spawns the same thing with the id and the marker already made. Picked
  over the scheduler holding pids: nothing to lose on a restart.
- `run --detach` writes the marker and spawns the run's process the way a scheduler's tick does,
  answering the id at once: the line a dashboard's start hook runs. Picked over the
  dashboard spawning the run's process itself, which would name the tool and hold a pid.
- The run is a checkout from the branches package, a session from `agent-driver`, the
  prompt once, and the agent's own loop to the end. No system prompt, no gates, no
  steering: the command's skill file is the whole instruction. Picked over carrying The
  Framework's run child over: its flow is the dashboard's, not a scheduled run's.
- The agent publishes its own work through the skills in its checkout; the run reads the
  pull request back off the branch for the record, through the command the project's git host
  package declares, never through a git host's own client. Picked over the run opening the
  request from the branch's commits, and over the agent leaving a title and body in a file.
- A run with a follow-up tells its agent, in a line after the prompt, to open the pull request
  without arming its merge, and the tool merges it through the git host once the follow-up ends
  done. Picked over a hold on the checkout that the agent's publish honoured, which put the
  git host inside the branches package.
- The live record is agent-driver's log, written in the run record's shape, and the run
  copies the two files onto the branch unchanged. Picked over the tool's own live log in
  the dashboard's shape, converted at the end: one shape, one file, no temporary label.
- A run's live directory is hidden from git in the run's checkout alone, by a `.gitignore`
  of `*` inside it, one already there kept. Picked over a rule in the repository's shared
  exclude file, which every checkout reads, the project's own included, and over the
  dashboard forcing its add past that rule.
- A run ends `waiting` when its last turn asked and nothing waited in the inbox: recorded
  so, its checkout kept for the answer. The answer, or a text, resumes the same run: the
  same id, the same record, the same branch, the session resumed by the id the record
  carries, the diary continued. Picked over a new run per answer (two records for one
  piece of work, and the first left waiting for ever) and over a process that waits for
  the answer (nothing waits; state in files).
- A run is on Claude Code, or on Codex with `run --driver codex`. The person picks.
- Either coding agent does the same: it works, pushes its branch and opens its pull
  request itself. For that, neither may be restricted: Claude Code runs with permissions
  bypassed, Codex with full access. Codex's default lets it write only in its checkout, so
  it could not push. Picked over a restricted Codex with agent-runner pushing for it: a
  run would then end in two different ways, and agent-runner would do the agent's work.
- A resumed run is on the coding agent its record names.
- A run's Claude Code starts without the person's own setup: their auto-memory, their
  claude.ai connectors, their user settings (with the skills synced from their claude.ai
  account). A run does the same job on every machine. Each part comes back on one machine
  with its own line under `personal:` in `.agent-runner/config.yml`. Picked over one line
  for the whole setup, on by default or off by default.
- A run with no model named starts on the coding agent's own default. Picked over the
  runner reading the scheduler's model: the runner reads no scheduler file, and the
  launcher already says "the CLI's own default".
- The run records itself and reclaims its own checkout when the agent stops; the sweep on
  the tick catches what a dead process left, on this machine only.
- A run stops on SIGINT or SIGTERM to its process: the agent's process tree is ended, the
  run is recorded `stopped`, the checkout reclaimed. The pid is in the live log, so a
  dashboard's Stop is that signal. Picked over the run reading the dashboard's control file
  (the tool would read a file of The Framework's shape), and over dying at once (the agent's
  processes would outlive the run, and the sweep would record it `failed`).

## When a run needs a person
- When a run ends waiting on a question, or ends done with a pull request it did not have,
  the runner runs a line the person wrote: `ended:` in `.agent-runner/config.yml`, with one
  line for a person in `MESSAGE`. The runner names no service; what the line does is the
  person's. Picked over the agent posting (it can forget, and a dead run posts nothing) and
  over the dashboard watching the runs (nothing posts while no dashboard is open).
- The line is per machine, out of git, beside the run locks. Picked over a committed file:
  where to post is set per machine, and a teammate's machine should not post to your
  channel.
- A question and a new pull request only. A run that fails, is stopped, or ends done with
  nothing to review runs no line. Picked over a line on every end: the line is for what
  waits on a person.

## The command line
- Every command prints one JSON document on stdout, one line for a person on stderr, and
  exits 0 for a result, 1 for a refusal or a failure, 2 for a command line that cannot be
  read: the skills' contract, so a person and a dashboard read it the same way.
- `run --detach --resume <id>` continues an ended run in its own process and answers its
  id at once: the line a dashboard's resume hook runs, the sibling of `run --detach`. A
  run this project has no record of is refused while someone is still listening; anything
  after that is the resumed run's own record. Picked over the hook running the resume in
  the foreground, which would hold the dashboard's request open for the whole turn.
