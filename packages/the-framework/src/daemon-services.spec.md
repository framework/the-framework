Everything the daemon runs in the background beside serving the dashboard: Discord notification watchers (#627), the Discord chatbot (#680) with its reply mirror (#932), auto PM (#685/#773), the conversation committer (#912), the merged-worktree sweep (#1036), plus resume of suspended runs (#923).

## TLDR

- `startBackgroundServices(deps)` → `{quiesce, flushConversations, reloadDiscord, wakeAutoPm, autoPmReport}` — the two shutdown phases plus the live-reload hooks the dashboard drives.
- Auto PM: while the queue is dry and quota is spare, triage/spike/plan/drain tickets rather than let the day's allowance expire. Wired with: open queue entries (not a bare emptiness bit — concurrent drains pin one entry each, #1204), per-project active-run counts, global concurrency + opt-outs (#1209), a file-persisted maintenance schedule (#882: must survive daemon restarts or a daily-rebooted machine sweeps every morning), stale pinned-branch release (#1293), durable entry claims off run metas + PR lookups with a cross-machine leg via open-PR queue patches (#1253/#1313), daemon-side queue promotion (#852: the agent stays sandboxed in its worktree; the daemon copies the one known file after a clean finish), and the [Spike & plan] fan-out seams (#1327/#1420: `spikeCandidates` lists open tickets with no plan and no `.lock.md` claim, most important first — no stale-lock sweep, #1420 removed the timer; `lockSpikes` writes/commits/pushes the `CLAIMED: <AGENT_ID>` lock files before the agents start — the daemon pushes because an agent only pushes at session end onto its own branch, #1320).
- Discord is one group rebuilt by `reloadDiscord()` (#1095): two `KeyedWatcher`s (needs-you interventions + activity) posting to the webhook, the chatbot (bot token) and the reply mirror that posts a session's settled replies (from the committed conversation, #908) back to the channel that asked.
- All three background starters go through `startUnattended`: the project's resolved run options (global prefs → repo `the-framework.yml` → project overrides — same mapping and layer order as the launcher, #858) plus forced `unattended: true`.
- `resumeSuspendedRuns(env, startRun, log)`: per project, read + immediately clear the suspended records, drop too-old ones, and continue each (`continueRunId` + `resumeSession` + `queueEntry` pin) with `RESUME_PROMPT`.

## Decisions

- Each service is gated the same way: an env var/credential says *where*, a preference says *whether* — and the preference is read per tick/post/message so a header toggle takes effect without a daemon restart. Watchers keep observing while off, so flipping on starts from now rather than blasting the whole open backlog.
- `unattended` is forced on top of project settings, not read from them: it is a property of nobody being at the keyboard, and without it every choice gate parks forever on an answer that is not coming (#846). Centralized so no starter can forget either half.
- `reloadDiscord` chains on a promise: two saves landing together would otherwise interleave a start with a stop and leave a gateway socket nobody holds. Initial startup goes through the same reload path (resolving stored credentials needs a registry read the daemon must not block on).
- The reply mirror's `readConversation` distinguishes "run genuinely gone" (`undefined` → release the binding so per-poll IO stops growing, #941) from a transient registry/meta outage (`[]` → keep the binding). A daemon-spawned run's transcript is read from its worktree (`meta.cwd`), not the project root.
- Drain runs carry the ticket (#1117) and the pinned queue entry (#1253) onto the run's meta — the one moment the framework knows what a run implements; suspended records carry the pin too (#1268) so the claim survives restarts. The drain job's `autoMerge` rides the same start options (#1216), reaching the run as `--auto-merge` so its PR lands itself. A fanned-out planner carries its pinned ticket too, but marked `planRun` (`--plan-run`): its PR lands the plan, not the work, so the title must not inherit the ticket's issue as `(fix #42)` (#1334) — the merge would close the issue with the work still undone.
- Quiesce ordering: everything that can start or steer a run stops first; the committer's timer is stopped in quiesce so `flushConversations` is a single flush past the idle window, not a wait for a poll that is no longer coming.
- Auto PM ticks once at startup (#1161) so a daemon started with the setting on does not idle a full interval with quota going spare; `wakeAutoPm({onDemand: true})` (#1210) sweeps even while the preference is off, because the click is the ask.
- Promotion outcome: a finished run is settled either way (one that wrote no queue is not going to start); the only retry is a checkout busy with the user's own queue edits, which the callee flags.

## Facts

- `homeId = projectId(resolve(cwd))` — `resolve` matters: `--cwd` arrives verbatim and a relative path would hash to an id no lookup resolves.
- Chat has no project picker: a Discord message with no bound run starts a run in the daemon's home project, with `via: DISCORD_VIA` so even the opening turn is filed under Discord (#917).
- A bot token with the `discordBot` preference off logs a one-line notice — otherwise the bot connects and ignores everything, which reads as broken rather than off.
- Auto PM opt-outs and concurrency are global, like the master switch: the rotation is one schedule for the machine, not one per repo.
- `RESUME_PROMPT` tells the resumed agent (which has its whole session) the one thing it is missing: why it suddenly stopped.

## Flows

- auto PM tick: `enabled?` → per project: open queue entries → claimed entries (run metas + `resolveRunPr` + cached open-PR queue patches) → quota-boundary gate → `start` job unattended (ticket + queueEntry pinned) → poll `promote` until the run settles → `promoteQueue` lands the pinned entry.
- discord chat: bot receives message → `startUnattended(homeId, text, {via: discord})` → `onRunBound` binds run↔channel in the mirror → mirror polls the committed conversation → posts new agent turns to the channel.
- notification: `KeyedWatcher` polls projects → builds interventions/activity → new keys → preference check at post time → webhook post (failure logged, not thrown).
- boot: `resumeSuspendedRuns` → read + clear records → age-cap → `startRun(RESUME_PROMPT, {unattended, continueRunId, resumeSession?, queueEntry?})` per run.
- shutdown: `quiesce()` (Discord group, auto PM, merged-worktree sweep, committer timer) → [daemon suspends runs] → `flushConversations()`.
