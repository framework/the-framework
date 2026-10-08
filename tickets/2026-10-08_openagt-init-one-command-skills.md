Topics: skills, init, dashboard
Issue: [#2023](https://github.com/openagt/openagent/issues/2023)

# `@openagt/init`: one command gives a project its skills

## TLDR

A person who adds a project to OpenAgent gets almost no skills today. `npx @openagt/init` becomes the one front door: it sets up a project, shows the skills as a list with ticks, writes the ticked ones as tracked files, offers one commit (never a push), and ends by asking "Open the dashboard?". A skill's text calls its command by its full name and a version range (`npx @openagt/skill-tickets@^1 list`), so nothing is installed in the project.

## Why it matters

Only this repository works fully, because it was set up by hand: 24 skill texts copied and committed, ten packages added to the root `package.json`, two scheduler lines added to `.openagent/hooks.yml`. No command repeats that. In any other project the agents cannot ask a question, and there are no tickets, no queue, no scheduler and no launcher commands. Worse, a text that says `npx tickets` in a project without the package runs whatever stranger's package holds that name on npm (`tickets`, `queue`, `logs`, `github`, `browser`, `discord`, `orchestration` and `question` are all taken there).

## Today

- "Add project" makes the folder a git repository if needed, creates the hidden `.openagent` folder with three lines, and adds the folder to the person's projects. It writes no skill text, touches no `package.json`, tracks nothing.
- One skill reaches a new project: branches, linked into every agent checkout at the start of a run, hidden from git.
- A skill needs up to three things in a project: its text, its command (eight skills have one), and its dashboard page, shown when the project's `package.json` lists the package and it is installed.
- An agent's checkout starts from the remote's default branch: only what is on that branch reaches it.
- Of the 34 packages meant for npm, 10 are published; the scheduler, the GitHub Actions driver and 22 skills are not.

## The proposal

1. **A project has a skill when the skill's text is in the project**: a tracked `.agents/skills/<name>/SKILL.md` with a tracked link at `.claude/skills/<name>`. The dashboard brings the pages itself (Tickets, Queue, the subagents settings) and shows each for the projects holding that skill's text; a project's `package.json` is no longer read for this. Deleting a skill's folder removes the skill.
2. **A text calls its command by full name and version range**, never the bare name. The text and its command move together (`@^2` for a version 2 text). Measured: about 1.1 seconds a call, against 0.3 seconds for an installed command.
3. **`npx @openagt/init` shows the skills in groups, with ticks**:
   - Tickets and queue (9): tickets, queue, plan, plan-tickets, triage, update-tickets, work-queue, suggest-new-tickets, suggest-tickets-to-work-on.
   - Reviews and research (8): maintainability, maintenance, readability, security-audit, ux, research, market-research, suggest-new-features.
   - Subagents (1): orchestration. After a merge (1): post-merge-cleanup.
   - Needs its own setup (2), not ticked: browser, discord.
   - The scheduler.

   Enter writes the ticked skills. Run again, the ticks show what the project has; a tick added writes a skill, a tick removed deletes it. `npx @openagt/init add <name>` and `remove <name>` do the same for scripts. A skill init does not know is left alone.
4. **Four basic skills come with every run**: branches, logs and question, and github when the remote is on GitHub, linked into each agent checkout, hidden from git, as branches is today. A project's own tracked copy wins. "Add project" names these four in what it adds. This point was decided by the agent, not a person.
5. **"Add project" stays as it is.** The project shows one line ("This project has 4 of 25 skills") with an "Add skills" button opening the same list. The dashboard and the command run the same code.
6. **A newer text**: the dashboard says so in one line ("3 skills have a newer text") with an "Update" button, and init says the same. Updating rewrites the files; the person reads `git diff` and commits or discards. A newer command arrives by itself inside the range.
7. **The commit**: init asks "Commit these files now?" and makes one commit on the current branch holding only the skill files, never a push, then says what is left (push, or a pull request when the default branch is protected). "Add skills" offers the same commit. While a text is in the folder but not on the branch agents start from, the dashboard says so ("Tickets: waiting to reach main"), so the launcher never offers a command the agent lacks.
8. **The scheduler is a tick**: it writes the two start and stop lines into `.openagent/hooks.yml`, by full name. That file is hidden from git, so this tick is per person and per machine, with no commit. It fits #2022.
9. **A project not on GitHub**: init does not offer github and says in one line that agents push their branch and the person opens the request.

## Open questions

1. Is point 4 right: four skills arrive without a commit while the others need one?
2. Is the scheduler ticked by default? It does nothing with no scheduled row, and whether a row starts switched off is open in #2022.
3. Newer than what? Init through `npx` carries the latest texts; the dashboard carries those of its installed version. The two can disagree.
4. "Update" overwrites a text changed by hand. Is the diff enough, or should init say which files differ from any version it knows before writing?
5. Eleven skill texts mention pull requests or issues: what each does with no git host skill is unchecked.
6. Does a skill break when another is unticked (work-queue without queue, plan-tickets without tickets)? To check before the list lets a person untick one alone.
7. What `npx` does for a full name with no network is unchecked. With `--offline` it runs from its cache in 0.3 seconds.
8. Only the folders of Claude Code and Codex are written.
9. A package of default skills, and picking by use case (`--use-cases`), are left for later.
10. This reverses written decisions (a skill's command is a dependency of the project; a project's pages come from its `package.json`): those texts have to be rewritten by a person.

## Not part of this

- Publishing. Init cannot work until every skill is on npm at a version 1 (a range over 0.0.1 matches that one version only).
- The scheduled rows and the Automations page: #2022.
- A skill for another git host.
- How the sidebar behaves when one project is picked.

## Cost

- A new package, `@openagt/init`: the command, and the code the dashboard's "Add skills" screen shares with it.
- The eight skill texts naming a command are rewritten for full names; every package goes to version 1.
- The dashboard: the skills' pages become its own, shown by the rule of point 1; the "Add skills" screen; the newer-text line; the waiting-to-reach-main line.
- The runner links four texts into a checkout where it links one.
- This repository: its 24 copied texts are written by init like anyone's. Its skill packages stay in the root `package.json` only so `npx` runs the checkout's own build.
- No code for the old way: nobody outside uses it.
