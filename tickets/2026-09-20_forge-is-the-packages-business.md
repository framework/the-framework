Topics: [the-framework, modularity]
GitHub: [#1820](https://github.com/framework/the-framework/issues/1820)

# Working with no forge, and with GitLab, Bitbucket or a custom one: the forge is the packages' business

## TLDR

Can The Framework work with no git provider at all, and with GitLab, Bitbucket or a custom provider instead of GitHub? Yes to both, and the way there is decided: **GitHub is a skill**. A `skill-github` package owns `gh` and declares one command, `framework.forge`; no other skill mentions GitHub or gh. GitLab means replacing `skill-github` with `skill-gitlab`, which is not a priority — the priority is the clean modularization.

## Why it matters

A project on GitLab, or one with no forge at all, cannot use the framework today: the reads answer "none" and Open PR fails with gh's error. Making the forge one package's business is the module model as built, and it is the last skill still spread across the framework, the branches package and the scheduler.

## What skill-github is

A package that teaches an agent how to work with GitHub in its SKILL.md (pull requests, merge on green, issues), and declares one command the framework and the scheduler run, the way tickets and queue do: `framework.forge`. The command answers a small contract: the pull requests of the project and of one branch, open one, merge one, the ones merged since a time, the project's URL. No forge package means the framework shows "Push" as a finished run's last step and no pull-request rows. `skill-gitlab` answers the same contract.

## The rule, and what it decides

No skill names another skill. Under it, the branches package may neither call the github command nor load it as an adapter — so **the adapter-inside-branches lean is dropped**. Branches shrinks to git: list, show, push, remove. The framework and the scheduler compose push then open through the two declared commands, branches and forge, and still name no skill. Publish stops being one package's word; that part of #1817 is undone.

## Where GitHub and gh are today, outside any github skill

- **Code calling gh**: `skill-branches` (`src/publish.ts`, `src/merge-watch.ts`, `src/merge-hold.ts`); `agent-scheduler` (`src/pr.ts`, the gh probe in `src/scheduler.ts`, merge on green in `src/run.ts`); the framework (`src/dashboard/gh.ts` with five readers — `interventions.ts`, `agent-handoff.ts`, `git-status.ts`, `cloud-work.ts`, `cloud-scratch-refs.ts` — plus the "Open on GitHub" link in `src/dashboard/github.ts`).
- **Code naming GitHub without gh**: `skill-tickets`, in eleven source files (the `GitHub:` ticket key, "Update from GitHub", the issue label and URL); framework labels and notices.
- **SKILL.md files naming GitHub**: tickets, logs. The prompt skills say "issue tracker" and "pull request" already; work-queue writes `Closes #<number>`.

## No forge

Runs, checkouts, tickets, queue and logs are files and git; none needs a forge. Today the gap is that nothing says "no forge". With no forge package installed the framework hears it and shows it: no pull-request rows in the Human Queue, "Push" as a finished run's last step instead of "Open PR", and, if landing without a forge is wanted, the branches package merges the branch into the default branch and pushes.

## The build, in order

Each step is one pull request that deletes more than it adds.

1. `skill-github`: its SKILL.md and the `framework.forge` command, moved out of `skill-branches`'s request half and `agent-scheduler`'s `pr.ts`.
2. `skill-branches` loses publish's request half and merge; the framework and the scheduler compose through `framework.forge`; gh deleted from both.
3. The framework's five reads and the "Open on GitHub" link go through `framework.forge`; `dashboard/gh.ts` and `dashboard/github.ts` deleted.
4. `skill-tickets`: the `GitHub:` key becomes a tracker link the forge skill fills in; "Update from GitHub" becomes "Update from the tracker"; the SKILL.md of tickets and logs stop naming GitHub.

## See also

#1818 (what the module PRs left behind), #1819 (the agent's browser as a package).
