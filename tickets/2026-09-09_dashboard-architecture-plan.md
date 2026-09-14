Priority: 9
Topics: [dashboard, skills, daemon]
GitHub: [#1774](https://github.com/framework/the-framework/issues/1774)

# Dashboard architecture: the plan and six questions

## TLDR

The plan for #1768. The issue body's recommendations are superseded by the picks comment (2026-09-09) and the daemon-half comment (2026-09-13); where they differ, the picks win:

- **Q1, where a skill's dashboard code lives:** out of the framework, in the skill's own package, on its own export path (a separate package later if a reason shows up).
- **Q2, how the framework knows a skill:** capabilities. The framework names no skill and imports no skill. Routines are prompts; the agent reads the project's skills folder and composes the skills itself. A missing capability is reported by the agent (a `show-error` skill as the channel). Verified by a 16-run experiment ($3.69): the agent composes skills from Sonnet up; the prompt must carry the *rules of the job* (one entry, never ask, how to publish, stop when empty). "Skill absent" must mean both its `SKILL.md` and its package are gone. Stalled agents leave locks.
- **Q3:** no skill knows another. Cross-skill features are the dashboard composing generic pieces (actions on links, agent ids as links).
- **Q4:** the dashboard reserves nothing. Each skill's widget defines its route, sidebar row, Overview card, actions — or nothing.
- **Q5:** live runs are the framework's; finished runs belong to the records (logs) capability, no fallback archive. Without it, a finished run vanishes with its checkout and the page says so, naming the capability, not our package.
- **Q6, order:** (1) SKILL.md files tracked in projects; (2) the daemon half; (3) the dashboard half — slots/sockets, logs widget first; (4) queue, tickets, branches one at a time.

## Progress

- Step 1: done (#1778, the tickets, queue and logs skills are tracked files of the project).
- Step 2, the daemon half: merged as #1777 (2026-09-14). Picks from the 2026-09-13 comment: the drain is a routine skill `work-queue/SKILL.md` with `disable-model-invocation: true` fired as `/work-queue`; the daemon fires when the `agent-data` head moves by a commit it did not write (chained, plus a daily heartbeat); checkout-before and record-after stay framework code importing branches and logs for now (zero imports at step 4); stalled locks handled by a release rule in the routine plus the ticket page's Release button; proof = three real queued entries drained unattended.

## What is left

- Follow-ups from the daemon half, one PR each: the four rotation jobs (update tickets, triage quick, triage consensual, plan tickets — last, its fan-out needs design) become routine skills until the daemon imports nothing from tickets; routines declare their own triggers so the scheduler knows no names; the scheduler becomes a library package.
- Step 3, the dashboard half (UI later, per the maintainer).
- Step 4, queue, tickets, branches widgets; branches to zero imports.

## Why it matters

This is the concrete plan behind the highest-priority issue: it removes every hard-coded skill from the daemon and the dashboard so skills can be skipped or swapped.

## Source

Imported from GitHub issue [framework/the-framework#1774](https://github.com/framework/the-framework/issues/1774), created 2026-09-09. Comments folded through 2026-09-13T17:23Z.
