Topics: scheduler, skills, dashboard
Issue: [#2022](https://github.com/openagt/openagent/issues/2022)

# Automations: skills bring the scheduled rows, each person sets when they run

## TLDR

A project's scheduled commands stop being lines of a hand-written `agent-schedule.md`. A command skill says in its own `SKILL.md` that it can be scheduled, with its check and its default pace, so an installed skill adds its own row. Each person sets the rest per repository: whether the row runs, its pace (down to a time of day), and how far its runs publish. A new Automations page shows and sets the rows.

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

   A skill with two modes lists two rows, as `triage quick` and `triage consensual` are today. The exact shape is open; the point is that the row, its check and its default pace travel with the skill. A skill that is not in the project has no row.

2. **Each person sets the rest, per repository.** Whether the row runs, its pace, and how far its runs publish.
   - A row starts at the pace its skill says. The person can set another as a number and a unit: minutes, hours, days, weeks or months ("every 15 minutes", "every 2 weeks", "every 2 months").
   - A row that has a check also offers "whenever there is work", and "As the skill says" takes the pick back.
   - A pace in minutes or hours is the least time since the command last started, as today.
   - A pace in days, weeks or months may also name a time of day ("every 2 days at 10:00"), like a calendar event: the row is then due from that time on, on a day at least that many days after the day it last started. The time is the machine's own local time. A week is 7 days and a month 30; picking a weekday ("every Monday") is left out.
   - All of it is saved where the switch and the publish pick already are, so nothing tracked changes.

3. **`agent-schedule.md` goes away.** The skill holds the default, the person's state holds the choice, and there is no third place. No code for the old file: nobody outside uses it.

4. **An Automations page.** The scheduler's package brings it, the way it brings its Settings section today. One row per scheduled command of the project: its switch, its pace, its publish level, and what the scheduler last decided for it ("no work", "quota", "started run …"). Settings keeps only what reaches every project (the spend offset).

## Open questions

1. Does every row start switched off? Proposed: yes, a skill that arrives in a project should not start spending quota by itself. It changes this repository, where four of the six lines run today unless a person switched them off.
2. The cap: does it stay with the skill? It counts runs across every machine that shares the repository, so it is not one person's to set.
3. Two people on one repository can pick two paces for the same row. The pace counts from the command's last start on any machine, so they do not double up, but the faster pace, or the earlier time of day, wins for both. Is that fine?
4. An unknown `schedule` key in a skill file must be harmless to Claude Code and to Codex. To check before building.
5. The scheduler looks for a command under `.claude/skills` only. The launcher reads `.agents/skills` too. The rows should be read from both.
6. A row set to 10:00 when the scheduler is not running at 10:00 (the dashboard closed, the laptop asleep) or has no quota then. Proposed: start it once, when the scheduler next can, and never twice for one missed day.
7. Saying in words what a row waits for. A check is a shell line, so the page cannot turn it into a sentence. To show "when there are merged pull requests to write up", the skill has to give that short line beside its check. Without it the page can only say "when its check finds work".
8. This reverses a written decision. `packages/agent-scheduler/DECISIONS.md` says the schedule is a tracked file a person writes, and that a line is the team's default. That text has to be rewritten by a person.

## Not part of this

- A new project has no scheduler: the package is not one of the built-in ones, so the page shows only where a project installed it. What a new project gets by default is a question of its own.
- A person's own prompt as an automation. It fits later as an "Add" button on the page that saves the prompt as a command skill, which then has a row like any other. Such a row runs by a time. A check is optional there: a shell line the person types, kept with the command like any skill's check, and only a row that has one is offered "whenever there is work".

## Cost

The scheduler package: how it reads the rows, its state, its command line, its part of the dashboard. The five scheduled skills each gain their lines (six rows, `triage` has two). This repository's `agent-schedule.md` is deleted.

## References

- The conversation behind the issue: https://gist.github.com/suleimansh/80905bcea8c6428db0f4a10207ababc8
