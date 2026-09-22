Effort: 2
Uncertainty: 3

# [Plan] Dashboard architecture: the plan and six questions

What is left of #1774 on main 1d324acb (2026-09-23), and how to finish it.

## TLDR

Nearly all of #1774 is built. The ticket's text still lists the Q8 steps as future work, and they are on main. Two open points remain:

1. **Claims left by a dead run (Q6.4).** Nothing lifts them except a person's Release.
2. **The daemon's four remaining clock jobs.** Each needs a person's pick: keep it, move it, or remove it.

Recommendation: resolve both points, then close the ticket. The dashboard half has its own ticket (`2026-09-09_dashboard-architecture.md`), and so do the module leftovers (`2026-09-20_modular-structure-leftovers.md`). Neither belongs here.

## Where main is (1d324acb)

Done since the last plan:

- **Q8.1, the launcher.** It starts runs through the project's start hook, and the daemon runs no agent (#1798). It lists only the project's commands (#1800). The built-in presets are gone; only a person's own custom presets stay (`packages/framework/src/project-presets.ts`).
- **Q8.2, the start hook.** `start` and `resume` are run hook kinds (`packages/framework/src/project-hooks.ts:36`). `agent-scheduler run --detach` answers with the run's id.
- **Q8.3 and Q8.4, the transport.** agent-driver owns the inbox (`packages/agent-driver/src/inbox.ts`) and names the live card and diary files (`logCardFile`, `logDiaryFile`). `run` takes `--driver`, `--resume` and `--then`. The browser option was dropped on purpose; `2026-09-20_agent-browser-as-a-package.md` brings it back as a package.
- **Stop.** A run stops on SIGINT or SIGTERM to its process, and the dashboard's Stop is that signal (`packages/agent-scheduler/DECISIONS.md:119-121`). No `stop-run` verb was needed.
- **The CI watch.** It is gone with the daemon's agent runner (#1798). Merging on green is `publish --merge` in the branches tool (#1807). No `fix-ci` command was built.
- **The worktree sweep and branch links.** They are gone from the daemon. The scheduler's sweep reclaims a dead run's checkout (`packages/agent-scheduler/src/sweep.ts`).
- **The framework knows no skill.** The four skill packages are `devDependencies` of `packages/framework/package.json`. Only the end-to-end harness imports them (`src/e2e/harness.ts`, `src/e2e/fake-run-bin.ts`). The pages and cards are the packages' own (#1812-#1826).

Still on the daemon's clock (`packages/framework/src/daemon-services.ts:209-235`):

- data sync (with the provider check);
- Discord watchers;
- cloud scratch sweep;
- cloud work adoption.

None of them starts a run.

## Problems

1. **Dead run, live claim (uncertainty 3).** When a run's process dies, the sweep writes the run `failed` and reclaims its checkout. A claim the agent took stays: the holder is the run's branch or `AGENT_ID`, and only `npx tickets release` by that holder, or a person's Release, lifts it. The locked ticket is skipped by `plan-tickets`, `triage` and `work-queue` until then.
2. **The four daemon jobs (uncertainty 3).** Rom's direction of 09-21 settles most of this: the dashboard is secondary, drastically simpler, and Discord as a module is a later thought.

## Solutions

For problem 1:

- **A. Leave it to a person.** The tickets page already has Release. Cost: a ticket can sit locked for days unnoticed.
- **B. The sweep releases the claim.** When the sweep records a dead run, it runs `npx tickets release --force` for each claim held by the run's id. This makes `agent-scheduler` name the tickets skill, which Q3 forbids.
- **C. A scheduled command releases stale claims.** A `release-stale-claims` line in `agent-schedule.md` checks for claims whose holder has a run recorded `failed` or no run at all, using `npx tickets list` and `npx logs`. The command's SKILL.md composes the two skills. No tool names a skill.

Pick **A** for now, and write it as a DECISIONS.md line in `packages/skill-tickets`: "a dead run's claim is lifted by a person". C is the clean fix if stale locks turn up in practice. B is rejected: it breaks Q3.

For problem 2, suggested picks:

- **Data sync:** keep it. The dashboard projects files and needs them fresh.
- **Cloud scratch sweep and cloud work adoption:** keep them with web runs in the dashboard server, as Q7 says.
- **Discord watchers:** keep them as they are. Moving them is the "later thought"; not this ticket.

With these picks, problem 2 needs no code.

## Implementation

1. Post one comment on #1774 (🤖 marked, per the project's posting rules, on Suleiman's word only). It says:
   - Q8 steps 1-4 are built; the CI watch went without a `fix-ci` command; Stop is a signal to the run's process.
   - The two picks above, as proposals.
   The next ticket import folds the comment into this ticket.
2. On his picks: add the one DECISIONS.md line for problem 1 (needs his pick; an AI only proposes one).
3. Close the ticket and its issue. Anything left moves to the two sibling tickets.

## Considerations

- A DECISIONS.md bullet changes only on a person's pick.
- The daemon jobs are framework code, so "the framework names no skill" does not constrain them.
- No compatibility code (AGENTS.md: zero users).
