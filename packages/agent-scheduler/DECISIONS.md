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
  becomes a dashboard, a projection of files, and this is the thing that decides when
  agents start.
- Two tools: `agent-runner` runs one agent from start to end, `agent-scheduler` keeps the
  timetable and has `agent-runner` run what is due. Picked over one tool doing both: its
  name said schedule, yet it ran every agent, the Start box's too.
- The scheduler uses `agent-runner` as a library, not its command line: the tick writes
  the marker, counts the cap again, and only then spawns the run, so it needs the run's id
  before the run exists.
- Standalone, beside `agent-driver`, not inside it. `agent-driver` depends on nothing; the
  runner and the scheduler need git for the checkouts and the records, and inside the
  driver every user of the driver would get git and the skills with it. Either way was
  open; this one for now.
- The scheduler depends on `agent-runner` for the runs, the records and the sweep, on
  `agent-driver` for the quota reading, on the branches package for the project root, on
  the logs package to count the records, and on `agent-data` for the branch. It never
  depends on The Framework, and The Framework never depends on it.
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
- The model every scheduled run starts on is per user, in the state file, set with `model
  <id>`, `opus` when unset. Picked over a line in the tracked schedule, so each person
  controls what their own machine spends their quota on. The state's model is a Claude
  model: a scheduled run is on Claude Code.

## The tick
- The checks in the cheapest order: the command exists, the check says due, the cap, then
  the quota. The quota is read only when everything else says start, because the reading
  spawns the agent's CLI and its usage fetch is refused upstream when asked too often.
- The quota gate is The Framework's spend boundary, copied: a window in force may be used
  only as far as the week has elapsed, plus the user's cushion, half a day when unset.
  Picked over a plainer line (a window at 100% stands down): nothing would pace the week.
  Copied rather than moved into `agent-driver`, which is not this tool's to change.
- Two machines may mark for one command at once. The cap is the first `cap` records in
  time order; a machine whose marker ranks past it withdraws the marker and does not spawn.
  A push that fails twice is another machine getting there first: withdrawn, no spawn.
- A running record from another machine counts against its command's cap until that
  machine or a person ends it; a stuck command is fixed by hand.
- A run counts for the schedule line its prompt names, and the scheduler decides that when
  it counts the records; the run's record holds only the prompt. Picked over the runner
  reading the schedule to name the command: the runner reads no scheduler file.
- The daily heartbeat and the transport retry The Framework's daemon had are dropped: a
  failed run leaves its queue entry for the next tick.

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
