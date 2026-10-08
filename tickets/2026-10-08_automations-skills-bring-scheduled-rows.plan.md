Effort: 6
Uncertainty: 5

# [Plan] Automations: skills bring the scheduled rows, each person sets when they run

How to move the scheduled rows from `agent-schedule.md` into the command skills' `SKILL.md` files, keep each person's switch, pace and publish pick in the scheduler's state, and replace the Settings rows with an Automations page.

## Problems

1. **A person must rewrite `packages/agent-scheduler/DECISIONS.md` first** (open question 8). Three bullets say the opposite of the ticket: "The tool names no skill and no command. What runs comes from the schedule file" (The tool), all of "The two files" about `agent-schedule.md`, the line's `publish` being the team's default, and "over a clock time (`at 09:00`: machine-local, and two machines fire twice)", which the time of day reverses. The file says an AI never adds or rewrites a bullet. The work can be built before the text lands, but it cannot merge without it.
2. **Whether an unknown `schedule` key in front matter is harmless** (open question 4). Nothing in this repository answers it. `disable-model-invocation` is already a key Codex does not define, and both skill folders carry it today, which suggests unknown keys are ignored, but it is not proof for a nested map.
3. **Every row starting off** (open question 1) changes this repository: `work-queue`, `update-tickets`, `plan-tickets` and `triage quick` run today wherever nobody switched them off, and would stop on every machine until switched on again.
4. **The time of day with two machines** (open questions 3 and 6). The pace counts from the command's last start on any machine, read off the run records, so two machines do not double up. But "due from 10:00 on a day at least N days after the day it last started" compares local days, and two machines in two time zones disagree on what day a start fell on.
5. **Where the cap and the publish default live** (open question 2). The ticket's example front matter has only `every` and `when`; today's lines also carry `cap`, `off` and `publish`.
6. **A command's identity when one skill has two rows.** Today the line's name (`triage quick`) is the prompt, the key of the switch and the publish pick, and what a run record is counted under (`promptCommand` in `src/schedule.ts`).

## Solutions

1. Propose the new bullets in the pull request's description, for the person to paste or rewrite; change nothing in `DECISIONS.md` in the commits. The plan below is written against these proposed bullets:
   - a row comes from a command skill's own `SKILL.md`; the tool still names no skill;
   - the skill holds the check, the default pace and the cap; a person's state holds the switch, the pace and the publish pick; every row starts off and publishes nothing until a person says so;
   - a pace in days or more may name a machine-local time of day.
2. Test it before building, once per coding agent: add `schedule:` to one command skill in a scratch checkout, start Claude Code and Codex there, and see the skill listed and run as before. If either refuses or warns, the fallback is a sibling file in the skill's folder, `schedule.yml`, same content: the row still travels with the skill. Front matter is preferred because the launcher (`packages/openagent/src/project-commands.ts`) already reads it there to decide what is a command.
3. Take the ticket's proposal: every row starts off. `off` then needs no word in the skill, and the state's `switches` becomes "the rows this person switched on". Say in the pull request that the four rows stop until switched on.
4. A missed time is caught up once: the rule "due from that time on, on a day at least N days after the day it last started" already gives this, since a late start moves "the day it last started" to today. For two machines, each compares in its own local time; the earlier one wins for both, as the ticket's question 3 already accepts for paces. No extra state.
5. The cap stays with the skill (`cap:` beside `every` and `when`, 1 when absent): it counts runs across machines, so it is not one person's. The publish default leaves the skill: with the row off until a person switches it on, the person who switches it on also picks how far it publishes, "Nothing" until then. This drops "as the file says" from the publish menu and the `file` word from `agent-scheduler publish`.
6. Keep the name as the identity. A skill's `schedule` is one row or a list of rows; a row may carry `argument: quick`, and its name is then `triage quick`, as today. A skill listing two rows with the same name has the second skipped and named in the tick's decisions, like an unreadable line today.

## Considerations

- **The shape.** One row: `schedule: { every: 15m, when: …, cap: 1, waits: … }`. Two rows: `schedule: [{ argument: quick, every: 6h, when: … }, { argument: consensual, every: 7d, when: … }]`. `waits` is the short line of open question 7 ("merged pull requests to write up"); the page says "when its check finds work" without it. At least one of `every` and `when`, as today. Units in the skill: `m`, `h`, `d`, and now `w` and `mo` (7 and 30 days).
- **The checks contain backticks, quotes and `$(…)`.** In YAML they go in a block scalar (`when: >-` or `|-`), read as one shell line. The parser is the `yaml` package the launcher already uses; `agent-scheduler` gains it as a dependency.
- **Which skills are read** (open question 5). Both `.claude/skills` and `.agents/skills`, the first readable copy of a folder deciding, exactly as `readProjectCommands` does. The scheduler cannot import that function (it never depends on OpenAgent), so it has its own reader in `src/`; `projectHasCommand` and `COMMANDS_DIR` go, since a row only exists where its skill does. Only a skill with `disable-model-invocation: true` gets rows.
- **Scheduled runs are on Claude Code**, which expands `/<name>` from `.claude/skills`. A row read from `.agents/skills` alone would start a prompt Claude Code cannot expand. Either skip such a row with a decision that says why, or leave it to the run to fail; the first is kinder.
- **In this repository the skill is in three places**: `packages/skill-<name>/SKILL.md` (published), `.agents/skills/<name>/SKILL.md` (tracked copy, identical today) and `.claude/skills/<name>` (a link to the copy). The five skills change in both tracked places, and each package's `SKILL.LOGIC.md` gains the row.
- **The state.** `switches` (only `true` is kept), `publishes` (as today, minus the fallback to a line), and a new `paces`: per command, absent for "as the skill says", else `{ work: true }` for "whenever there is work" (the check alone, offered only when the row has a check) or `{ every: N, unit: 'minutes'|'hours'|'days'|'weeks'|'months', at?: 'HH:MM' }` with `at` allowed from days up. A row with a check keeps its check whatever the pace: the pace only says how often at most. A row without a check that is set to "whenever there is work" is refused by the command line.
- **A pick for a row that is gone** (the skill was removed) stays in the state and shows nowhere; it comes back with the skill. Simpler than pruning, and `cleanup` already removes the whole file.
- **The decision lines** the page shows are the tick's as they are (`not due (last start 2h ago, every 6h)`, `quota: …`, `started <id>`); a row with a time of day needs its own (`not due (next from 10:00 on 2026-10-10)`). "Switched off on this machine" stays, so an off row says why it never starts. "No such command in this project" goes.
- **The status the page reads.** `lastTick.schedule` is "the schedule as the tick read it", so a scheduler that never ticked lists nothing. The page should list rows before any tick: `status` reads the skills itself and returns the rows with the switch, the pace and the publish level in force, plus the last tick's decision per row.
- **Settings keeps the spend offset only**, and the usage bar's stop line is untouched. The Overview's Scheduler card keeps its last-tick list.
- **`promptCommand` and the records** work unchanged: they need the list of row names, wherever it comes from.
- **Nothing reads the old file after this**: no fallback, no migration, per the project's rule that breaking changes are free. `cleanup`'s line "agent-schedule.md is yours and stays" goes with it.
- **Not built here**: a person's own prompt as an automation, a weekday pick, and a scheduler in a new project (the ticket's "Not part of this").

## Implementation

1. **Check the front matter key** with both coding agents (Solution 2). Pick front matter or the sibling file from what they do.
2. **`src/schedule.ts`**: replace `parseSchedule`/`readSchedule` over the markdown file with a reader of the skill folders: `readSchedule(repo)` returns `{ commands, unreadable }` from every command skill's `schedule`, a row being `{ name, skill, when?, every?, cap, waits? }`. `on` and `publish` leave `ScheduledCommand`. Keep `isDue`, `commandPrompt`, `commandSkill`, `promptCommand`. Tests: one row, a list, an argument, a block-scalar check, a skill in both folders read once, a skill that is not a command, a duplicate name, an unreadable row, the new units.
3. **A pace module in `src/`**: the pace in force for a row (the person's, else the skill's), and `isPaceDue(pace, lastStart, now)`: elapsed time for minutes and hours and for days and up without a time; the calendar rule for a time of day, in the machine's local time. Tests cover the missed day started once, a start late in the day, and month as 30 days.
4. **`src/state.ts`**: `paces` with `withPace`; `isSwitchedOn` without the line's default; `publishInForce` without the line's level; `ScheduleLine` gains `waits` and `cap`, loses `on` and `publish`.
5. **`src/tick.ts`**: drop the `hasCommand` step and dep; use the pace in force in place of `command.every`; note `no scheduled command in this project` in place of `no agent-schedule.md`. **`src/scheduler.ts`**: `status` returns the rows as read now (Considerations).
6. **`src/cli.ts`**: `switch` and `publish` look the row up among the skills' rows (`not-scheduled` when absent; `no-schedule` goes); `publish` loses `file`; new `pace <command> <skill|work|N unit [HH:MM]>`. Usage text, `names.ts` (`SCHEDULE_FILE`, `COMMANDS_DIR` out; the two skill folders in), `cleanup.ts`'s wording.
7. **`dashboard/`**: a `pages` entry in `index.tsx` (`segment: 'automations'`, label "Automations") with a new `Automations.tsx`: per project, one row per scheduled command with its switch, its pace (a number, a unit, a time when the unit is days or more, "whenever there is work" when it has a check, "As the skill says (every 15m)"), its publish menu, what it waits for, and the last decision. `SchedulerSettings.tsx` shrinks to the spend offset; `schedulers.ts`, `fixtures.ts` and the tests follow.
8. **The five skills, six rows**: move each line of `agent-schedule.md` into its skill's `SKILL.md` (both tracked copies) as written above, each with a `waits` line; delete `agent-schedule.md`.
9. **The words**: every `LOGIC.md` of the scheduler package (read the `logic-driven-development` skill first), the five skills' `SKILL.LOGIC.md` and `LOGIC.md`, the root `LOGIC.md` (lines on `packages/agent-scheduler` and on the unattended work), `packages/LOGIC.md`, and `packages/openagent/README.md` where it tells how to schedule a command.
10. **The pull request** says: the four rows that ran by default are off until switched on in Automations; the proposed `DECISIONS.md` bullets, for a person to write in before it merges.

## For a person before the work

- Rewrite or approve the `DECISIONS.md` bullets (Problem 1).
- Confirm every row starts off and publishes nothing until picked (Solutions 3 and 5), since it stops this repository's four running rows.
