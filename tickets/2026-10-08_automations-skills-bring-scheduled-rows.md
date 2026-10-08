Topics: scheduler, skills, dashboard
Issue: [#2022](https://github.com/openagt/openagent/issues/2022)

# Automations: skills bring the scheduled rows, each person sets when they run

## TLDR

A project's scheduled commands stop being lines of a hand-written `agent-schedule.md`. A command skill says in its own `SKILL.md` that it can be scheduled, with its check, its default pace and its default number of agents at once, so an installed skill adds its own row. Each person sets the rest per repository: whether the row runs (every row starts switched off), its pace (down to a time of day), how many agents of it work at once, and how far its runs publish. A new Automations page shows and sets the rows.

## Why it matters

- A line can name a skill the project does not have. Its row still shows, looks switched on, and never starts; the reason ("no such command in this project") is only on the Overview card.
- Adding a row means editing a file. A check is a long shell line: this repository's are 200 to 500 characters each, mostly `jq`.
- The check lives far from the skill it belongs to. Whoever brings a skill into a project has to bring its line too.
- The pace is the team's. One person cannot slow a command on their laptop without editing a tracked file.
- A project with no `agent-schedule.md` has no rows at all, whatever skills it has.

## Today

- A project's scheduled commands are the lines of a tracked file at its root, `agent-schedule.md`. A line names a command skill, its pace (`every 6h`), its check (a shell line that says there is work), its cap, and how far its runs publish.
- A person changes two things on their own machine, in Settings → Scheduler: whether a line runs, and how far its runs publish. Both are saved in `.agent-scheduler/state.json`, per user, hidden from git.
- The scheduler names no skill. It runs what the file lists.

## Proposal

1. **A command skill says it can be scheduled.** In the front matter of its `SKILL.md`, next to the line that already makes it a command:

   ```yaml
   ---
   name: update-tickets
   disable-model-invocation: true
   schedule:
     every: 15m
     when: npx tickets meta | jq …
   ---
   ```

   A skill with two modes lists two rows, as `triage quick` and `triage consensual` are today. The exact shape is open; the point is that the row, its check, its default pace and its default number of agents at once travel with the skill. A row with a check also carries one short plain line saying what it waits for ("when a ticket has no plan yet"), because a check is a shell line the page cannot turn into a sentence. A skill that is not in the project has no row.

2. **Each person sets the rest, per repository.** Whether the row runs, its pace, how many agents of it work at once, and how far its runs publish.
   - Every row starts switched off: a skill that arrives in a project starts no agent by itself. That changes this repository, where four of the six lines run today unless a person switched them off.
   - A row starts at the pace its skill says. The person can set another as a number and a unit: minutes, hours, days, weeks or months ("every 15 minutes", "every 2 weeks", "every 2 months").
   - A row that has a check also offers "whenever there is work", and "As the skill says" takes the pick back.
   - A pace in minutes or hours is the least time since the command last started, as today.
   - A pace in days, weeks or months may also name a time of day ("every 2 days at 10:00"), like a calendar event: the row is then due from that time on, on a day at least that many days after the day it last started. The time is the machine's own local time. A week is 7 days and a month 30; picking a weekday ("every Monday") is left out.
   - All of it is saved where the switch and the publish pick already are, so nothing tracked changes.
   - **How many at once.** A row starts at the number its skill says, 1 when it says none. A machine starts another agent of a command only while fewer than its person's number are working on it, counting the agents of every machine that shares the repository. The person asked for "per user"; counting every machine's agents is the curating agent's reading.
   - **Two people, two paces.** The pace counts from the command's last start on any machine, so the work never runs twice. The machine of the person with the faster pace, or the earlier time of day, starts it.
   - **A missed time.** A row set to 10:00 when the scheduler is not running then (the dashboard closed, the laptop asleep), or has no quota then, starts once when the scheduler next can. It never starts twice for one missed day.

3. **`agent-schedule.md` goes away.** The skill holds the default, the person's state holds the choice, and there is no third place. No code for the old file: nobody outside uses it.

4. **An Automations page.** The scheduler's package brings it, the way it brings its Settings section today. One row per scheduled command of the project: its switch, its pace, its number of agents at once, its publish level, what it waits for in plain words, and what the scheduler last decided for it ("no work", "quota", "started run …"). Settings keeps only what reaches every project (the spend offset).

## Open questions

1. An unknown `schedule` key in a skill file must be harmless to Claude Code and to Codex. To check before building.
2. The scheduler looks for a command under `.claude/skills` only. The launcher reads `.agents/skills` too. The rows should be read from both.
3. This reverses a written decision. `packages/agent-scheduler/DECISIONS.md` says the schedule is a tracked file a person writes, and that a line is the team's default. That text has to be rewritten by a person.

## Not part of this

- A new project has no scheduler: the package is not one of the built-in ones, so the page shows only where a project installed it. What a new project gets by default is a question of its own.
- A person's own prompt as an automation. It fits later as an "Add" button on the page that saves the prompt as a command skill, which then has a row like any other. Such a row runs by a time. A check is optional there: a shell line the person types, kept with the command like any skill's check, and only a row that has one is offered "whenever there is work".

## Cost

The scheduler package: how it reads the rows, its state, its command line, its part of the dashboard. The five scheduled skills each gain their lines (six rows, `triage` has two). This repository's `agent-schedule.md` is deleted.

## References

- The conversation behind the issue: https://gist.github.com/suleimansh/bb86e7791fd530ffdfec00f1f6a9ca64
