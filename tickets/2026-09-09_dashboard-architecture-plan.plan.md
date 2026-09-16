Effort: 6
Uncertainty: 6

# [Plan] Dashboard architecture: the plan and six questions

What is left of #1774 now that Q7 is built, and the order to do it in.

## TLDR

Most of Q6 and Q7 is on main (9bb62321, 2026-09-16). The work that remains:

1. Fix the ticket where main disagrees with it.
2. Move the daemon's other background jobs off its clock, or remove them. Each job needs a person's pick.
3. Turn launcher presets into commands (#1770).
4. Let a person stop a scheduled run.
5. Have agent-driver write the live log.
6. Do the dashboard half. Its plan is on the #1768 ticket (`2026-09-09_dashboard-architecture.md`), not here.

Most of the uncertainty is in step 2. The design is settled; step 2 needs picks, not research.

## Where main is (9bb62321)

- **Done:**
  - Step 0, `work-queue` tracked in the project (#1781).
  - The `agent-scheduler` package (#1782). It has `tick`, `run`, `start`, `stop` and `status`, the two files, the per-run process, and the sweep.
  - The open and close hooks, plus the Scheduler card on the Overview (#1784).
  - Four routine commands and `every` in the schedule (#1785).
  - `agent-schedule.md` at the root lists `work-queue`, `update-tickets`, `plan-tickets`, `triage-quick` and `triage-consensual`.
  - `@gemstack/routines` is gone from `packages/framework/package.json`.
- **Where the ticket is stale.** `packages/agent-scheduler/DECISIONS.md` is the source of truth. The ticket text should follow it:
  - Q7.2's open point (how the PR title and body reach the publisher) is closed. The agent publishes through the branches skill, and the run reads the PR back off the branch.
  - Q7.3 and Q7.6 say "marker files". Main uses the run record itself, written with `status: running` before the spawn.
  - Q7.6 says "the daemon's clock calls each project's `tick` during the transition". Main does not do this. `start` is the only clock, and the dashboard's hooks start and stop it. The Framework names no tool.
  - Q7.4 says "cap per command in the schedule file". Main does that, and it also has `every`.
- **Still on the daemon's clock** (`packages/framework/src/daemon-services.ts:329-367`):
  - worktree sweep
  - branch links
  - data sync
  - CI watch (it can start fix runs)
  - Discord watchers
  - cloud scratch sweep
  - cloud work adoption
- **The framework still knows skills:**
  - `packages/framework/package.json:49-53` depends on `agent-data` and the four skill packages.
  - 24 non-test source files under `packages/framework/src` and `packages/framework/dashboard` import one of them.
  - The #1768 plan covers this.

## Problems

1. **What happens to each daemon job (uncertainty 7).** Each job goes one of three ways:
   - a scheduled command (a skill plus a line in `agent-schedule.md`);
   - a job inside `agent-scheduler`;
   - removed.

   The Q7 goal is "the daemon becomes a projection of files". That points away from keeping any of them. But some jobs serve only the dashboard's own runs:
   - The worktree sweep and branch links serve the dashboard's checkouts.
   - Cloud work adoption serves the dashboard's web runs, and Q7 says web runs stay with the dashboard server.
2. **CI watch starts agents (uncertainty 6).** The only agent-starter left in the daemon is the CI fix (`autoPm`). Under Q7, starting agents belongs to the scheduler. A scheduled `fix-ci` command would need a `when` check that lists red PRs owned by agents.
3. **Stopping a scheduled run (uncertainty 5).** The pid is in `.the-framework/agent.json`. Main has no verb that stops a run. Two options:
   - a `stop-run <id>` on `agent-scheduler`;
   - the dashboard's Stop button signals the pid it reads.

   The second option makes the dashboard act on a file it only projects.
4. **Stalled locks (Q6.4, open).** A run that dies leaves its claim. The sweep reclaims the checkout, but the claim is released only by a person.

## Solutions

1. Suggested picks for the daemon jobs, for a person to confirm:
   - **data sync:** keep it in the dashboard for now. A projection needs fresh files. Later it can become a read on demand.
   - **worktree sweep and branch links:** keep them in the dashboard while the dashboard runs its own agents. Remove them once presets become commands (step 3).
   - **cloud scratch sweep and cloud work adoption:** keep them with web runs in the dashboard server, as Q7 says.
   - **Discord watchers:** make them a scheduled command, or remove them. This is Rom's call, since it is a notification feature.
   - **CI watch:** make it a scheduled `fix-ci` command package, with `when` = a `gh pr list` check for failing agent PRs and `cap 1`. Then remove `autoPm` and `ci-watch.ts`.
2. For the Stop verb, `agent-scheduler stop-run <id>`: it signals the pid in the run's `agent.json`, and the run records itself as stopped. The dashboard's hook file can map a Stop button to it the same way `open` and `close` map to `start` and `stop`. That keeps the dashboard free of tool names.
3. For stalled locks, the sweep can release the claims held by the id of a run it reclaims. The run's id is the holder, so no skill knowledge is needed beyond `npx tickets release`. That call would make the scheduler name a skill, though. The alternative is to leave it to the person's Release button.

## Implementation (one PR each, in order)

1. **Ticket and issue sync.** Post a short comment on #1774 listing the four stale points above. The ticket importer then folds it in. No code.
2. **`fix-ci` command.**
   - Add a `packages/skill-fix-ci` command skill, tracked as `.claude/skills/fix-ci`.
   - Add its schedule line.
   - Remove the CI watch job, `ci-watch.ts`, and the `autoPm` switch.
   - Update FEATURES-SPEC.md if the repo has it again (memory says it was removed; check first).
3. **Presets → commands (#1770).** Follow that ticket's plan.
4. **`stop-run`.**
   - Add the verb to `agent-scheduler`, with its LOGIC.md and tests.
   - Add a `stop-run` hook key in `project-hooks.ts`.
   - Add the Stop button for scheduled runs.
5. **Live log in agent-driver.** Move the temporary `.the-framework/agent.json` / `events.jsonl` writer out of `packages/agent-scheduler/src/live-log.ts` into agent-driver, as DECISIONS.md "The run" asks.
6. **The rest of the daemon jobs.** Apply whatever a person picked for Discord, the sweeps and data sync.
7. **The dashboard half.** Follow the #1768 plan (slot contract, discovery, data path, logs first).

## Considerations

- Changing any DECISIONS.md bullet needs a person's pick. An AI only proposes one.
- Each new command package must name no other skill. It composes capabilities through its SKILL.md prompt (Q2 and Q3).
- "A skill is absent" means its SKILL.md and its package are both gone. The scheduler already checks `.claude/skills/<command>`.
- Cutover after each merge: pull and build main, and restart the daemon. Scheduled commands start only on machines where the user's `hooks.yml` runs `agent-scheduler start`.
- No compatibility code (AGENTS.md: zero users).
