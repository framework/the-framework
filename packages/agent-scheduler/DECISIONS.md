Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The tool
- A tool, a package with a command line, like `agent-driver`; not a skill. It owns one
  small process with a clock, and nothing else runs agents on a schedule. Picked over a
  skill the agent would read, and over a job inside OpenAgent's daemon: the daemon
  becomes a dashboard, a projection of files, and this is the thing that decides when
  agents start.
- Two tools: `agent-runner` runs one agent from start to end, `agent-scheduler` keeps the
  timetable and has `agent-runner` run what is due. Picked over one tool doing both: its
  name said schedule, yet it ran every agent, the Start box's too.
- The scheduler uses `@openagt/agent-runner` as a library, not its command line: the tick writes
  the marker, counts the cap again, and only then spawns the run, so it needs the run's id
  before the run exists.
- Standalone, beside `agent-driver`, not inside it. `agent-driver` depends on nothing; the
  runner and the scheduler need git for the checkouts and the records, and inside the
  driver every user of the driver would get git and the skills with it. Either way was
  open; this one for now.
- The scheduler depends on `@openagt/agent-runner` for the runs, the records and the sweep, on
  `@openagt/agent-driver` for the quota reading, on the branches package for the project root, on
  the logs package to count the records, and on `agent-data` for the branch. It never
  depends on OpenAgent, and OpenAgent never depends on it. Its dashboard part is
  the exception: it is drawn with the dashboard's module contract, and the tool itself runs
  without it.
- The tool names no skill and no command. What runs comes from the project's skills: a
  skill says in its own file that it can be scheduled, and a skill that is not in the
  project has no scheduled command. Picked over the tool linking a command's skill into the
  checkout from a package: a project tracks its skills, and the tool reads the project.
- One scheduler per project, since the schedule comes from the project's skills and the
  state sits in the project. Picked over one per machine reading a registry of projects:
  nothing machine-wide is left for it to hold.

## The schedule and the state
- The schedule is the project's skills. A skill brings its scheduled command in the front
  matter of its `SKILL.md`, under `schedule`: its check, its pace, how many agents may run
  it at once, and one plain line saying what the check waits for. Picked over
  `agent-schedule.md`, a tracked file at the repository root that a person wrote, one line
  per command: a line could name a skill the project did not have, the check lived far from
  the skill it belongs to, and a project with no such file had no scheduled command
  whatever its skills. The check is a shell command run at the repository root; due means
  it exits 0 and prints a JSON value that is not empty. Picked over the tool reading the
  branch head (every commit was a start, most of them empty), over the tool reading the
  queue (the tool would know a skill), and over a bare clock (empty runs). A `schedule` the
  tool cannot read is skipped and named, never guessed.
- A skill's check may name the commands of other skills (`npx queue`, `npx tickets`),
  though the words a command skill gives the agent name none. The scheduler runs the check;
  the agent is never given it. Picked over keeping the checks in a file of the project,
  away from the skill they belong to.
- Every scheduled command starts switched off, on every machine, and runs only where a
  person switched it on. Picked over a command that runs unless a person switched it off: a
  skill that arrives in a project would start agents by itself.
- The schedule is read from both folders a coding agent reads skills from, `.claude/skills`
  first. A command whose skill is only in `.agents/skills` is listed and never started, and
  the tick says so: a scheduled run is on Claude Code, which reads `.claude/skills` only.
  Picked over reading `.claude/skills` alone, where such a skill would have no row and
  nothing would say why.
- How far a scheduled command's runs publish is each person's pick on their own machine, in
  the state file like the switch; the scheduler's own Automations page shows the pick and
  changes it. Until a person picks, a run commits its work and pushes nothing. Picked over
  a level written beside the command for the whole team, which a person could only
  override: nothing leaves a machine before its own person said so.
- A skill paces its scheduled command two ways, alone or together: `when` says there is
  work (the check's output), `every` says how often at most (the least time since the
  command's last recorded start, read off the run records on the branch, so every machine
  agrees and nothing new is stored). A routine whose run changes nothing cannot be paced by
  a check alone: it would start every minute. Picked over a rotation of the routines in a
  fixed order behind an empty queue (one command then depends on another, and idle it
  started an agent every 30 minutes). Order is what the numbers say.
- The skill's pace is where a command starts. Each person may set another for their own
  machine, in the state file like the switch: an interval in minutes, hours, days, weeks or
  months, or whenever there is work. Picked over the pace being the skill's alone, where
  slowing a command on one machine meant editing a tracked file.
- A pace in days, weeks or months may name a time of day, in the machine's own time, like a
  calendar event: the command is due from that time on, on a day at least that many days
  after the day it last started. A time that was missed runs once, as soon as the scheduler
  looks. This takes back the earlier pick against a clock time (machine-local, and two
  machines fire twice): the pace counts from the last start on any machine, so two machines
  never run the work twice.
- The state, `.agent-scheduler/state.json`, untracked, per user, hidden through git's
  exclude file the way `.branches/` is: on or off, keep-alive, the model, the spend
  cushion, this machine's switches, paces and publish picks, the scheduler's pid, the last
  tick and what it decided. Nothing the tool knows is only in memory; a restart loses
  nothing.
- Keep-alive, whether the scheduler outlives what started it, is per user, in the state
  file. Picked over a line in the tracked schedule: in the schedule it would switch on the
  next person's machine the first time they pull.
- The model every scheduled run starts on is per user, in the state file, set with `model
  <id>`, `opus` when unset. Picked over a line in the tracked schedule, so each person
  controls what their own machine spends their quota on. The state's model is a Claude
  model: a scheduled run is on Claude Code.

## The tick
- The checks in the cheapest order: the coding agent can run the command, it is switched
  on, it is due by its pace, the check says due, the cap, then the quota. The quota is read
  only when everything else says start, because the reading spawns the agent's CLI and its
  usage fetch is refused upstream when asked too often.
- The quota gate is OpenAgent's spend boundary, copied: a window in force may be used
  only as far as the week has elapsed, plus the user's cushion, half a day when unset.
  Picked over a plainer line (a window at 100% stands down): nothing would pace the week.
  Copied rather than moved into `agent-driver`, which is not this tool's to change.
- Two machines may mark for one command at once. The cap is the first `cap` records in
  time order; a machine whose marker ranks past it withdraws the marker and does not spawn.
  A push that fails twice is another machine getting there first: withdrawn, no spawn.
- A running record from another machine counts against its command's cap until that
  machine or a person ends it; a stuck command is fixed by hand.
- A run counts for the scheduled command its prompt names, and the scheduler decides that
  when it counts the records; the run's record holds only the prompt. Picked over the
  runner reading the schedule to name the command: the runner reads no scheduler file.
- The daily heartbeat and the transport retry OpenAgent's daemon had are dropped: a
  failed run leaves its queue entry for the next tick.

## The command line
- Every command prints one JSON document on stdout, one line for a person on stderr, and
  exits 0 for a result, 1 for a refusal or a failure, 2 for a command line that cannot be
  read: the skills' contract, so a person and a dashboard read it the same way.
- `start` is the only clock: OpenAgent's daemon does not tick. A dashboard that wants
  the scheduler on while it is open runs `start` when it opens and `stop
  --unless-keep-alive` when it closes, from a hook file of the user's that names the tool;
  OpenAgent itself names no tool. Picked over the daemon calling the tick, which would
  have made OpenAgent name the tool.
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

## The dashboard part
- The scheduler brings its own part of a dashboard: an Automations page (one row per
  scheduled command, with its switch, its pace and its publish pick), a Settings section
  (the spend cushion) and an Overview card (on or off, the last tick). All read `status`
  and write through `offset`, `switch`, `pace` and `publish`. Picked over a hook line per
  setting that a dashboard runs, and over the dashboard reading the state file by name. The
  rows are on a page of their own, picked over rows inside Settings: Settings keeps only
  what reaches every project.
