Keeps on disk everything The Framework itself knows about one agent [1]: the agent's event stream [2], appended one event per line inside its checkout [3]; a status snapshot [4] folded from that event stream, so a status read never replays it; the archive [5] of ended agents under the project; and, on top of those three, the reads and rescues every surface relies on — a restarted dashboard rehydrates an agent by replaying its event stream, a status snapshot left at `running` by a process that died is rescued into `stopped`, the run [6] the `logs` skill [7] keeps on the `agent-data` branch [8] is read back as the same event stream and status snapshot, and every history list shows the branch's runs and the archive together. The coding agent's [9] own conversation is never persisted here: only The Framework's own events are.

## Context

**User story**:
- The user starts an agent [1] and follows it live; closing the browser tab or restarting the daemon and coming back shows the same agent with the same events, status and questions.
- The Overview [10] lists every agent of a project, running and ended, newest first, including runs [6] recorded by other machines and other people on the `agent-data` branch [8]; an agent whose process crashed shows as `stopped` instead of as running forever with a "Stop" [11] button that does nothing.
- The user continues an ended agent from the dashboard and it stays one row, with its original label and its whole history, rather than becoming a second agent.

**Business logic story**: while an agent runs, the daemon tails the two live files in the agent's checkout [3]. When the agent's process is gone, the daemon's teardown in `daemon-runtime.ts` reads the agent out of its checkout one last time, through the read described below, and records it as a run on the `agent-data` branch through the `logs` skill [7] — the mapping between the two shapes is `run-record.ts` — and the checkout is then reclaimed [12]. So the run on the branch is the lasting record, the archive [5] is transient, and every history read looks in both places.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout". The user's own working copy is "the project's checkout" or "the user's checkout".
[4] status snapshot: `.the-framework/agent.json` in an agent's checkout: the agent's current state as one small JSON document, folded from its event stream, so that reading an agent's status never means replaying the stream.
[5] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[6] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[7] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[8] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[9] coding agent: the CLI doing the actual work: Claude Code or Codex.
[10] the Overview: the dashboard's cross-project page at `/`.
[11] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[12] reclaim: removing a finished agent's checkout once its work is on the remote.
[13] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[14] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session). On the status snapshot a fourth value, `remote`, marks an agent relayed to a device.
[15] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[16] surrogate end: the end event The Framework writes on behalf of an agent whose process died without reporting one, so the agent ends as `stopped` like any other.
[17] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[18] crash rescue: ending an agent whose status snapshot says `running` while the process that owned it is gone, so it stops showing as live and keeps its history; done on read for a provably dead process, and at daemon boot for every process the daemon cannot find.
[19] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[20] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[21] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[22] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[23] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[24] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[25] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[26] leg: one process's stretch of an agent's life: a fresh agent has one leg, and a continued agent one more per continuation, each leg writing into the same agent.
[27] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[28] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[29] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[30] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[31] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[32] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[33] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[34] agent view: one agent's page.
[35] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[36] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[37] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[38] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[39] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.

## Business logic — TL;DR

- **Two live files in the checkout** - an agent's [1] event stream [2] is `.the-framework/events.jsonl` and its status snapshot [4] `.the-framework/agent.json`, both inside the agent's own checkout [3]; every surface is a projection of the event stream.
- **Opening a fresh agent** - the agent id [13] the daemon allocated names the agent when it is path-safe, the process opening the store is the agent's owning process, and an agent still sitting in the live files is archived [5] before the event stream is truncated.
- **Continuing an ended agent** - a reopen keeps the event stream and the original label, flips the status snapshot back to `running` under the new process, and first puts the agent's history back into the checkout from the branch's run [6] or from the archive.
- **The status snapshot** - every fact on it is folded from one event kind by one pure rule, on a live append and on a replay alike; the end event settles the status as `done`, `stopped` or `failed`.
- **What is never persisted** - the coding agent's [9] own conversation, a `local` location [14], a relayed [15] agent's record, the "waiting on the bridge" and "another machine's" annotations, and the status snapshot's scratch file.
- **Appending and torn writes** - writes are serialized and best-effort, the status snapshot is swapped in whole so a poll never sees half of it, and a torn read is retried before it is called corrupt.
- **Reading an event stream** - a blank or torn trailing line ends the read with everything before it kept; a missing file is an empty event stream.
- **Closing: the archive** - closing flushes the writes and copies the two files into `.the-framework/agents/` as `<id>.jsonl` and `<id>.json`; the live files stay for the daemon's tail.
- **The last read of a checkout** - before a checkout goes, its status snapshot and event stream are read out of it for the run, a snapshot still at `running` gets the surrogate end [16], and the branch is stamped at that last moment.
- **The surrogate end** - the end written on behalf of an agent whose process died: `stopped`, with the detail "its process died without reporting an end", expiring the gate [17] it died holding.
- **Live agents and the crash rescue on read** - the live status snapshot is read from the project root and from every checkout under `.branches/`; one that says `running` while its owning process is provably gone on this host is flipped to `stopped` and archived on the spot (crash rescue [18]).
- **The crash rescue at boot** - a restarted daemon ends every `running` record whose process it cannot find: runs on the branch, archive entries, the live status snapshot, and agents inside checkouts; a process alive on this host is left alone; the checkouts are kept.
- **History from two places** - the history is the branch's runs plus the archive, de-duplicated by id with the branch's copy winning, newest first by id; live agents are listed ahead of it and win over their own archived copy.
- **One agent's events for replay** - an ended agent's events come from its run's diary on the branch, else from the archive; the paths of those files are exposed for a caller that needs the file itself.

## Business logic

### Two live files in the checkout

#### Context

**Problem**: the dashboard, the terminal, the archive [5] and the run [6] are each a projection of what the agent [1] did, so persisting the agent is persisting its event stream [2]; a separate state model would have to be kept in sync with the event stream and would drift from it.

#### Business logic

Inside the agent's checkout [3], under `.the-framework/`:
- `events.jsonl` is the event stream: one event per line, only ever appended, never rewritten. It carries The Framework's own orchestration events: what the agent was asked, which driver session [19] it runs and the link to it, what the agent said and answered per turn [20], its gates [17] and picks [21], its branch, its ticket, its pull request, its usage and cost, how its handoff [22] was armed and how the handoff reported, when it settled [23], and how it ended.
- `agent.json` is the status snapshot [4]: a small JSON document rewritten after every event, holding what a list row or a header needs — status, id, times, intent, branch, pull request, pending gate, cost, and the rest described under "The status snapshot" — so that reading an agent's status never means replaying its event stream.

The daemon tails both files while the agent runs, and a restarted dashboard rehydrates the agent by replaying the event stream into a fresh one; nothing else is kept in sync.

### Opening a fresh agent

#### Context

**Business logic story**: the daemon allocates the agent id [13] before it spawns the agent's [1] process, names the agent's checkout [3] with it under `.branches/`, and hands the id in, so that the checkout directory and the agent inside it are one string rather than two timestamps taken a moment apart.

#### Business logic

- The agent's id is the one handed in when it is path-safe — letters, digits, `_` and `-` only, and not the one name that would collide with the checkout of the `agent-data` branch [8] (the rule in `branch-names.ts` of the `branches` skill [7]). Otherwise the id is derived from the start moment: the ISO time with `:` and `.` replaced by `-`, so that ids sort chronologically (`agent-id.ts`).
- The seed status snapshot [4] says: status `running`; the id; the start time, which is also the last-updated time; the owning process, that is the process id and host name of the process opening the store, which is the agent's owner by definition; the intent when the caller gives one, so the row shows the prompt from the moment the store opens rather than only once the agent's own intent event lands; the location [14] only when it is not `local`; and the agent's kind, `build` or `prompt`, when given.
- A fresh open first rescues whatever agent still sits in the live files: unless that agent is already in the archive [5], its event stream [2] and status snapshot are copied there, so a crash that skipped the close loses no history. Only then is the event stream truncated and the seed status snapshot written.
- An open that is not fresh truncates nothing: it is the read side, for a caller that loads the existing events of an agent being resumed.

### Continuing an ended agent

#### Context

**User story**: the user continues an ended agent [1] from the dashboard; the continuation is a second process, yet the history shows one row with the original label and everything the first process recorded.

#### Business logic

- Before the second process starts, the agent's history is put back into its checkout [3]. Nothing is restored when the checkout already holds a live agent — its status snapshot [4] exists, and its event stream [2] is the newer one. Otherwise the run [6] is looked up on the `agent-data` branch [8] by the agent id [13]; when found, its diary becomes the event stream and its card becomes the status snapshot (the mapping in `run-record.ts`). A run the branch does not have is looked for in the archive [5], whose copy is put back as it is. An id that is not path-safe restores nothing, and nothing here ever fails loudly: the caller learns only whether something was restored.
- Reopening keeps the event stream and the prior status snapshot, and changes three things on the snapshot: the status flips back to `running`; the owning process becomes the process reopening it, so that a liveness check reads the agent as alive rather than as an orphan; and the last-updated time becomes now.
- The original intent is pinned for the whole continuation: a continuation's own intent event carries the resume message, not a name, and it must not relabel the row. A fresh agent has no pin, and its intent event refines the label as usual.
- When there is nothing to reopen — no status snapshot at the path — the open falls back to a fresh agent.

### The status snapshot

#### Context

**Problem**: the checkboxes, pills and lists that show an agent's [1] state live in a different process from the agent that writes it, and a browser tab opened after the agent started has no event history to fold. The status snapshot [4] is the one place such a reader can learn the state without replaying the event stream [2], so every fact a list surface or a sweep [24] needs is carried on it.

#### Business logic

Each event is folded into the status snapshot by one pure rule, the same on a live append and on a replay, and every event moves the last-updated time to the moment it was appended. The facts and their rules:

- **Driver and workspace** - the session event records the driver [25] and the directory the agent works in, and the session link when it carries one. The model is per leg [26]: the event's model becomes the snapshot's, and an event without one leaves the model unknown rather than inheriting a prior leg's, because a later leg may resolve a different default.
- **Session id and link** - the session-update event records the driver session's [19] id and, when given, its link, the one shown to jump into the live driver session.
- **Ready for merge** - the ready for merge [27] signal sets the flag that flips the agent's badge from building to ready.
- **Pending gate** - a gate [17] event records the gate's id and title as the gate the agent is parked on: present means the agent is paused waiting for the user's answer, the second "needs you" source after pull requests to review. The resolution event carrying the same gate id clears it.
- **Intent** - the intent event replaces the intent, unless a continuation pinned it.
- **Browser preview port** - the browser-stream event records the loopback port the agent's browser preview listens on, which is how the daemon, a different process, learns where to proxy the pane from.
- **Handoff arming** - the handoff-armed event records whether the handoff [22] is armed to push, to open a pull request, and to merge. The merge flag mirrors the merge arming for display only: the agent merges off its own configuration, never off the snapshot. A snapshot without this fact is read as armed to push and open a pull request, and as not armed to merge.
- **Handoff report** - the handoff event records how the handoff went: `done`, `skipped` or `failed`. Between a clean end and this fact, an armed agent is still pushing or opening its pull request, which is the window a list shows as "publishing…"; absent reads as "still going". When the report is `skipped`, its reason is recorded (for instance `no-commits`), and on any other outcome the reason is cleared: a continued agent's second leg can publish after its first leg skipped, and a stale `no-commits` on a published agent is exactly the lie a release must not act on. The reason is what lets the daemon tell "published elsewhere" from "ended with nothing to hand off": a drain [28] that settles with `no-commits` will never run the pull request that lifts its ticket's claim [29], so the sweep releases the claim it minted. Unless the handoff failed, the outcome of its merge half is recorded too — `auto-armed`, `merged`, `watched`, `withheld` or `failed` — which the CI watch [30] scans: `watched` is a pull request waiting for green that this machine must merge, `auto-armed` one GitHub lands by itself but whose checks going red is still this machine's to notice.
- **Ticket** - the ticket event records the ticket the agent implements, relative to the repository (`tickets/<file>.md`), only when The Framework picked the ticket itself, so that the Overview [10] can show a ticket being coded right now as implementing instead of inferring it from the plan the agent left behind.
- **Pull request** - the pull-request event records the number and URL once one is opened, so that no surface re-derives it from branch names and timestamps.
- **Branch** - the branch event records the branch the agent's work is on, as the agent observes it. The agent renames its branch itself when it names its work, so the branch named after the agent id [13] is not guaranteed to be the one holding the commits. The session name [31] is this branch minus its `agent-` prefix, read off it by every surface and never stored beside it.
- **Cloud anchor** - the cloud-anchor event records the cloud anchor [32] a hands-off [33] agent pushed; it is absent on every other agent and on a web agent whose push before the task left this machine failed.
- **Settled** - the settled event records when the agent settled [23]; the next turn's [20] start clears it, because a new turn means the agent is working again. It is deliberately not a status: the agent is still alive while it waits, still takes messages and still holds the project, and every reader keys "live" off the status `running`.
- **Cost** - each usage event that carries a price adds it to the running total in US dollars; the total is absent until one does.
- **End** - the end event settles the status: `done` when the agent finished well, `stopped` when it was stopped [11], `failed` otherwise. It records the end time and clears the pending gate (a finished agent awaits nothing), the settled time (nor is it waiting on the user) and the browser preview port (the preview dies with the agent, and a kept port would send the pane at whatever the operating system hands that number next).
- **Owning process, location and kind** - the process id and host of the owning process, the location [14] and the kind are seeded at open and never change through events. The location lets the agent view [34] tell a GitHub Actions agent's burst of events from a stalled live stream, show a cloud agent's session link after a reload, and switch the browser pane off. The kind lets a continuation re-enter the flow its first leg ran: the dashboard's resume always arrives as a prompt start, and without the record a resumed build agent [35] would end as a bare prompt agent.

### What is never persisted

#### Context

**Problem**: some facts belong to another owner or exist only in this daemon's memory; writing them to disk would either duplicate a record someone else keeps or freeze a fact that is only true for the process observing it.

#### Business logic

- The coding agent's [9] own conversation — its driver session [19], with every tool call — is never written here; the driver [25] keeps it and resumes it by session id. The event stream [2] keeps only The Framework's own events, among them what the agent [1] said and answered.
- A `local` location [14] is not written: absent means local, the default every reader assumes.
- Two annotations exist only on the way to the dashboard and are never on disk: that the Claude web bridge [36] holds a question the agent's cloud session [37] is parked on (the bridge's state lives in memory), and that the agent was started by another machine's daemon (the shared branch shows every machine's runs [6], and only this daemon knows which host it is). Both are added by the reads in `dashboard-rpc/reads.ts`.
- An agent relayed [15] to a device [38] has no checkout [3] and no process on this machine, so its status snapshot [4] — status `running`, the location `remote`, the prompt as intent, the device's label — is a memory-only record the daemon keeps while the agent runs (`daemon-runtime.ts`); it is never written to disk.
- The status snapshot's scratch file, `agent.json.<process id>.tmp`, is a transient step of a write (see "Appending and torn writes") and never a record: the archive [5] listing takes only `.json` files.

### Appending and torn writes

#### Context

**Problem**: the agent [1] rewrites its status snapshot [4] over and over while the daemon and every dashboard read poll it from another process. A plain write truncates the file before it refills, so a reader landing in that window sees an empty file and reports the agent gone: a live agent vanishing from every composed read for one poll.

#### Business logic

- An append first folds the event into the in-memory status snapshot, so that a snapshot taken right after already reflects it, then queues two writes: the event's line onto the event stream [2], then the whole status snapshot. Writes run one after another in order, so an append and its snapshot rewrite never interleave, and closing waits for the queue to drain.
- Persistence is best-effort: a failed write is reported on the daemon's console ("[framework] failed to persist orchestration state") and swallowed; it never breaks a live agent.
- The status snapshot is written to a scratch file beside it, named for the writing process, and renamed over `agent.json` in one step, so a reader gets either the whole previous snapshot or the whole new one and never half of either. The scratch file is per process because an agent and the daemon's teardown archiving [5] it can both be writing the same snapshot, and they must not splice their writes into one file. Every status snapshot write, live or archived, goes through this.
- A reader that finds a status snapshot it cannot parse asks again, up to two more times a moment apart, before calling it corrupt: a torn read is transient by construction. A file still unparseable after that yields no snapshot.

### Reading an event stream

#### Context

**Problem**: a crash in the middle of a write leaves a torn last line, and a reader that refused the whole event stream [2] would lose an agent's [1] entire history to one half-written line.

#### Business logic

An event stream is read line by line: blank lines are skipped, and the first line that does not parse ends the read, keeping everything before it. A missing file is an empty event stream. The one rule serves every reader — the live event stream of a checkout [3], the archive's [5] copy, and any reader outside the store, such as the Discord bot's gate [17] lookup — so that no second parser with a drifted torn-line policy exists.

### Closing: the archive

#### Context

**User story**: an agent [1] that has ended still shows in the project's history.

#### Business logic

- Closing waits for the queued writes, then copies the event stream [2] and the status snapshot [4] into `agents/` under the same `.the-framework/` directory, as `<id>.jsonl` and `<id>.json`. The live files stay where they are: the daemon keeps tailing them until the next agent. The copy is the same for the same id however often it is made, an id that is not path-safe is not archived, and a failed archive is reported on the daemon's console ("[framework] failed to archive run history") rather than thrown.
- Where that copy lands follows the checkout [3]: an agent in its own checkout under `.branches/` keeps its copy inside that checkout, which goes when the checkout is reclaimed [12]; an agent that runs at the project root — a project that is not a git repository has no checkouts to give — archives into the project's own `.the-framework/agents/`, as does the crash rescue [18] for any agent whose process died. The archive [5] is untracked by git and transient by design: the lasting record is the run [6] on the `agent-data` branch [8].

### The last read of a checkout

#### Context

**Business logic story**: once an agent's [1] process is gone and before its checkout [3] is reclaimed [12], the daemon's teardown reads the agent out of the checkout to record it as a run [6] on the `agent-data` branch [8]; the checkout is about to go, so this is the last moment the agent can be read.

#### Business logic

- The read yields the status snapshot [4] and the events of the checkout's `.the-framework/`. A checkout with no status snapshot, a snapshot without a path-safe id, or an unreadable one yields nothing rather than an error.
- A snapshot still at `running` is first given the surrogate end [16] in the checkout's own files: the process is already gone, so `running` means it died without closing, and the event stream [2] must end before anything copies it.
- When the caller hands in the branch it observed on the checkout, that branch is stamped on the snapshot: the agent may have renamed its branch, and this is the last moment the real one can be observed.
- The crash rescue's [18] variant of this read also copies what it read into the project's archive [5], where something can read it, and hands back the snapshot it archived.

### The surrogate end

#### Context

**Problem**: every reader of the event stream [2] — the dashboard's outcome pill, its gate [17] rail, the status snapshot [4] fold — keys "over" off a single end event. A process that dies without writing one (a crash, a forced kill, a process exit while parked on a gate) would leave the agent's [1] last question rendered as answerable forever, with its picks [21] read by nobody.

#### Business logic

An agent whose process died without reporting an end is given one on its behalf, the surrogate end [16]: an end that is not ok, marked stopped, with the detail "its process died without reporting an end". It is appended to the event stream and folded into the status snapshot exactly as an agent-written end would be, so the status becomes `stopped`, the end time is set, and the gate the agent died holding expires. Both writes are best-effort: healing never makes a read fail.

### Live agents and the crash rescue on read

#### Context

**User story**: an agent [1] whose process crashed, was killed, or died while the machine slept must not stay a running row with a "Stop" [11] button that does nothing; the dashboard clears it on its next poll, without waiting for a daemon restart.

**Problem**: nothing is left to read the control file [39] of such an agent, so steering it is a no-op.

#### Business logic

- The live status snapshot [4] of one checkout [3] is `.the-framework/agent.json`; a missing or torn file yields nothing, never an error. When it says `running` and its owning process is provably dead — a process id is recorded, its host is this machine, and no such process exists — the agent is given the surrogate end [16], archived [5], and returned as stopped: the crash rescue [18] on read.
- Only a provably dead owning process heals here. A snapshot with no process id, or one owned by another host, is left alone: a routine read must not end an agent another machine may own.
- A process is alive when the operating system still knows it, including one that belongs to another user; a process id recycled by an unrelated process reads as alive, an accepted and rare miss on a single machine.
- All of a project's live agents are read from the project root itself — where an agent runs when the project cannot be given a checkout — and from every directory under `.branches/` named as an agent branch; only directories count, never the rename links kept beside them, which are views onto a checkout and not checkouts. Each is read as above, so a stale one heals the same way; an unreadable candidate is skipped; the list is newest first by id; and each entry carries the checkout it runs in, so that its git and file status can be read from there.

### The crash rescue at boot

#### Context

**Problem**: a daemon that died mid-agent [1] never ran its teardown, so every agent it was driving is left marked `running` — on the `agent-data` branch [8], in the archive [5], in the live files, and inside checkouts [3] where nothing reads it. A fresh daemon drives no in-flight agent, so it can end them.

#### Business logic

At startup the daemon (`daemon.ts`) runs the crash rescue [18] over every place a `running` record can be, ending each one whose owning process it cannot find, in this order:
- Runs [6] on the `agent-data` branch: a card at `running` whose owning process is dead or unknowable is written again through the `logs` skill [7], with the ended status on the card and the surrogate end [16] as the last diary line — as one commit, because a card edited in place on the branch's checkout is not a fact yet: the next sync's rebase refuses the dirty tree and resets it. It counts as reconciled when the commit landed, pushed or not.
- Archive entries: the surrogate end is appended to `<id>.jsonl` and `<id>.json` is rewritten as stopped. These go before the live status snapshot [4], so the archive entry made from it is not counted twice.
- The live status snapshot at the project root: flipped through the surrogate end and archived.
- Agents inside `.branches/*` checkouts: the surrogate end is recorded in the checkout's own files first, so that the copy which follows is an event stream [2] that actually ends; then the agent is copied into the project's archive. The checkout itself stays on disk: an agent that ended this way did not end cleanly, and those are kept for inspection; removing one is an explicit action.
- Here an unknowable owning process — no process id recorded, or another host — counts as gone, unlike in the rescue on read: there is nothing better to go on. An agent whose process is alive on this host is left alone, so that a second daemon booting on the same machine does not mark genuinely live agents as finished.
- The daemon learns how many agents were reconciled; a read or write that fails skips that agent and never stops the rescue.

### History from two places

#### Context

**User story**: The Overview [10] and a project's history show every agent [1] once: those this machine recorded on the `agent-data` branch [8], those other machines and other people recorded there, and those only the crash rescue [18] archived [5].

#### Business logic

- The archived history is the runs [6] on the `agent-data` branch — every person's directory, read through the `logs` skill [7] and unfolded into the status snapshot [4] shape — plus the archive's entries whose id the branch does not have. The branch's copy wins: the crash rescue archives transiently and the teardown records on the branch, so one agent can sit in both and must show once. The list is newest first by id alone, since an id sorts chronologically. A torn or unparseable entry is skipped and a missing directory is no history; nothing here throws.
- A caller that polls for recent agents rather than the whole history passes a start time, and runs and entries started before it are left out. For archive entries the file name decides without the file being read, because the id is the start time: only a name of The Framework's own id form can be rejected that way, and any other id is read like the rest. The id is allocated at spawn and the start time recorded when the store first opens, so the name can be older than the start time by the length of a spawn, and a record can drop out of such a filter at most that much early.
- A project's agents are its live agents first, then the archived history minus every id that is live. Live wins over archived: a continued agent has an archived copy from its first leg [26] and is live again, and keeping the archived copy would show a running agent as finished. Reading one agent by id follows the same rule. A side that cannot be read contributes nothing.

### One agent's events for replay

#### Context

**User story**: opening an ended agent [1] replays its events; the tail of an ended agent and a retry reading its failure detail need the recorded files themselves.

#### Business logic

- An ended agent's events are its run's [6] diary on the `agent-data` branch [8], turned back into events (the mapping in `run-record.ts`), else the archive's [5] `<id>.jsonl` read by the torn-line rule; an unknown id, or one that is not path-safe, yields nothing.
- The files of one archived agent are its card and diary on the branch's checkout [3] when the branch has the run, else the archive's `<id>.json` and `<id>.jsonl`, else none.
