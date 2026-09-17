Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The tool
- A tool, a package with a command line, like `agent-driver`; not a skill. It owns one
  small process with a clock, and nothing else runs agents on a schedule. Picked over a
  skill the agent would read, and over a job inside The Framework's daemon: the daemon
  becomes a dashboard, a projection of files, and this is the thing that starts agents.
- Standalone, beside `agent-driver`, not inside it. `agent-driver` depends on nothing; the
  scheduler needs git for its checkouts and its records, and inside the driver every user
  of the driver would get git and the skills with it. Either way was open; this one for
  now.
- The tool depends on `agent-driver` for the session and the quota reading, on the branches
  package for the checkout and the reclaim, on the logs package for the records, and on
  `agent-data` for the branch. It never depends on The Framework, and The Framework never
  depends on it.
- The tool names no skill and no command. What runs comes from the schedule file, and a
  command runs only when `.claude/skills/<command>` exists in the project; else the state
  says "no such command in this project". Picked over the tool linking a command's skill
  into the checkout from a package: a project tracks its skills, and the tool reads the
  project.
- One scheduler per project, since the schedule is a file in the project and the state sits
  beside it. Picked over one per machine reading a registry of projects: nothing
  machine-wide is left for it to hold.

## The two files
- The schedule, `agent-schedule.md` at the repository root, tracked, written by a person:
  one list line per command with its check and its cap. The check is a shell command run at
  the repository root; due means it exits 0 and prints a JSON value that is not empty.
  Picked over the tool reading the branch head (every commit was a start, most of them
  empty), over the tool reading the queue (the tool would know a skill), and over a bare
  clock (empty runs). A list line the parser cannot read is skipped and named, never
  guessed.
- A schedule line paces a command two ways, alone or together: `when` says there is work
  (the check's output), `every` says how often at most (the least time since the command's
  last recorded start, read off the run records on the branch, so every machine agrees and
  nothing new is stored). A routine whose run changes nothing cannot be paced by a check
  alone: it would start every minute. Picked over a rotation of the routines in a fixed
  order behind an empty queue (one line then depends on another, and idle it started an
  agent every 30 minutes), and over a clock time (`at 09:00`: machine-local, and two
  machines fire twice). Order is what the numbers say.
- The state, `.agent-scheduler/state.json`, untracked, per user, hidden through git's
  exclude file the way `.branches/` is: on or off, keep-alive, the model, the spend cushion,
  the scheduler's pid, the last tick and what it decided. Nothing the tool knows is only in
  memory; a restart loses nothing.
- Keep-alive, whether the scheduler outlives what started it, is per user, in the state
  file. Picked over a line in the tracked schedule: in the schedule it would switch on the
  next person's machine the first time they pull.
- The model every run starts on is per user, in the state file, set with `model <id>`,
  `opus` when unset. Picked over a line in the tracked schedule, so each person controls
  what their own machine spends their quota on.

## The tick
- The checks in the cheapest order: the command exists, the check says due, the cap, then
  the quota. The quota is read only when everything else says start, because the reading
  spawns the agent's CLI and its usage fetch is refused upstream when asked too often.
- The quota gate is The Framework's spend boundary, copied: a window in force may be used
  only as far as the week has elapsed, plus the user's cushion, half a day when unset.
  Picked over a plainer line (a window at 100% stands down): nothing would pace the week.
  Copied rather than moved into `agent-driver`, which is not this tool's to change.
- A run in flight is its run record, written on `agent-data` before the agent is spawned
  with `status: running` and the tool's mark, and written again at the end over the same
  file. Picked over a separate marker file the sweep would have to match up with a record:
  one file for the run's whole life, and every machine counts the same records.
- Two machines may mark for one command at once. The cap is the first `cap` records in
  time order; a machine whose marker ranks past it withdraws the marker and does not spawn.
  A push that fails twice is another machine getting there first: withdrawn, no spawn.
- A running record from a machine that never comes back stays. Only the machine that wrote
  it, or a person, changes it. Picked over ageing it out after a fixed time, which would
  start a second agent beside a long run; a stuck command is fixed by hand.
- The daily heartbeat and the transport retry The Framework's daemon had are dropped: a
  failed run leaves its queue entry for the next tick.

## The run
- One process per run, one-shot: `run <prompt>` needs no scheduler running, and the tick
  spawns the same thing with the id and the marker already made. Picked over the
  scheduler holding pids: nothing to lose on a restart.
- The run is a checkout from the branches package, a session from `agent-driver`, the
  prompt once, and the agent's own loop to the end. No system prompt, no gates, no
  steering: the command's skill file is the whole instruction. Picked over carrying The
  Framework's run child over: its flow is the dashboard's, not a scheduled run's.
- The agent publishes its own work through the branches skill; the run reads the pull
  request back off the branch for the record. Picked over the run opening the request from
  the branch's commits, and over the agent leaving a title and body in a file.
- The live record is agent-driver's log, written in the run record's shape, and the run
  copies the two files onto the branch unchanged. Picked over the tool's own live log in
  the dashboard's shape, converted at the end: one shape, one file, no temporary label.
- A run ends `waiting` when its last turn asked and nothing waited in the inbox: recorded
  so, its checkout kept for the answer. The answer, or a text, resumes the same run: the
  same id, the same record, the same branch, the session resumed by the id the record
  carries, the diary continued. Picked over a new run per answer (two records for one
  piece of work, and the first left waiting for ever) and over a process that waits for
  the answer (nothing waits; state in files).
- The run records itself and reclaims its own checkout when the agent stops; the sweep on
  the tick catches what a dead process left, on this machine only. Agents in flight run to
  the end when the scheduler stops.
- A run stops on SIGINT or SIGTERM to its process: the agent's process tree is ended, the
  run is recorded `stopped`, the checkout reclaimed. The pid is in the live log, so a
  dashboard's Stop is that signal. Picked over the run reading the dashboard's control file
  (the tool would read a file of The Framework's shape), and over dying at once (the agent's
  processes would outlive the run, and the sweep would record it `failed`).

## The command line
- Every command prints one JSON document on stdout, one line for a person on stderr, and
  exits 0 for a result, 1 for a refusal or a failure, 2 for a command line that cannot be
  read: the skills' contract, so a person and a dashboard read it the same way.
- `start` is the only clock: The Framework's daemon does not tick. A dashboard that wants
  the scheduler on while it is open runs `start` when it opens and `stop
  --unless-keep-alive` when it closes, from a hook file of the user's that names the tool;
  The Framework itself names no tool. Picked over the daemon calling the tick, which would
  have made The Framework name the tool.
- A stop waits for the tick in flight, and that tick starts nothing more: the readings are
  where a tick spends its seconds, and a person who said stop gets no new agent. The ending
  scheduler clears only its own pid from the state, since a dashboard's close hook stops one
  scheduler and its open hook starts the next before the first is over. Picked over killing
  the tick mid-flight, which could leave a marker half written.
- `stop --unless-keep-alive` is the one reader of keep-alive: it leaves a keep-alive
  scheduler running and stops any other, so the line a dashboard runs when it closes
  honours the user's keep-alive while a person's plain `stop` still stops. Picked over
  `stop` reading keep-alive always (a person's stop must stop) and over a separate `close`
  verb (one stop).
