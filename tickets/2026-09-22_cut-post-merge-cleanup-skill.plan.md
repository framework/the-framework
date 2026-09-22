Effort: 2
Uncertainty: 4

# [Plan] Cut the post-merge-cleanup skill to a third of its length

The ways to do it and the one to take: keep only the knowledge files, in both modes, at about 250 words.

## TLDR

Recommended: **B**. The skill keeps one job, writing what merged work decided and taught into `knowledge-base/`. It keeps both modes, because the launcher box and the schedule use them. The two queue jobs go: `/maintenance <part>` already queues the same refactor and audit for any part. The new SKILL.md is drafted below at about 250 words, a third of 743.

## Options

- **A. Same three jobs, tighter wording.** Every rule stays, and only the sentences get shorter. This comes out at about 400–450 words, not a third. It still reads as three jobs, because it is three jobs. Rejected.
- **B. Knowledge files only, both modes (recommended).** The queue half goes (about 300 words) and with it the rules that exist only for it: skip refactor and audit pull requests, low priority, entry wording, already queued, retry on a rejected write, no AI queue. What stays is the job the landing page promises and the launcher box runs. Refactor and audit work after a merge is `/maintenance <the changed files>`, a command that already exists. Its wording is almost word for word the same as this skill's queue half.
- **C. Drop the skill.** This removes the package, the launcher box, `run --then` with its merge hold, and the schedule line. It is the cleanest cut, but it takes out a working chain (#1810, #1811) and the only writer of the `knowledge-base/` files the landing page promises. Rejected: that is a product call bigger than a SKILL.md cut. It is still possible later if B is never used either.
- **D. Split into two skills (knowledge + follow-up queueing).** Each would be short, but it adds a package, and Rom's direction is fewer, polished skills. Rejected.
- **E. B plus the queue half as one sentence ("then run the maintenance job on the changed files").** A command must name no skill (package DECISIONS.md, "Commands"). Rejected.

## Considerations

- **Run mode edge cases dropped.** "The pull request is merged already" goes: the scheduler holds the merge until this run ends, so only a person merging by hand reaches it. "The run opened no pull request" also goes: the follow-up starts only when the first run ended with one (`run.LOGIC.md` [11]). If either happens, the agent's own judgment covers it.
- **Kept on purpose:** skip a pull request whose body has `Post-merge cleanup done.` (the schedule's `when` line and the run mode both depend on it); skip one that only updates the knowledge files (otherwise the schedule loops on its own pull requests); the 24h fallback; "nothing worth writing: commit nothing".
- **The name stays.** "Cleanup" fits less for a knowledge-only job, but renaming touches the launcher box, the schedule line, tests and docs. Out of scope.
- **Maintenance is on the park list** (the ten parked packages). Pointing people to it for post-merge refactors is fine: parked means it stays in the repository.
- `FEATURES-SPEC.md`, which AGENTS.md mentions, does not exist in this checkout. There is nothing to update there. The feature lines live in `LOGIC.md` files.

## Implementation

1. Replace `packages/skill-post-merge-cleanup/SKILL.md` with the draft below.
2. `package.json` `description`: "The post-merge-cleanup command for coding agents: write what merged work decided and taught into the project's knowledge files, in a pull request a person reviews. A skill file only, no code."
3. Rewrite `SKILL.LOGIC.md` to match (drop "Two kinds of entry", "Already queued", "No AI queue", the queue part of "Skipped pull requests", and the merged-already and no-pull-request run cases). Follow the logic-driven-development skill.
4. Update the one-line summaries in `LOGIC.md:56` and `packages/LOGIC.md:22`: "post-merge-cleanup writes what merged pull requests decided and taught into the knowledge files". Check `packages/agent-scheduler/src/run.LOGIC.md` and `LOGIC.md:76`: they already say only "knowledge-file changes", so no change is expected.
5. Refresh the installed copy `.agents/skills/post-merge-cleanup/SKILL.md`.
6. Dogfood in a rig (not the live scheduler): `/post-merge-cleanup <a merged PR>` opens a knowledge-files pull request, and `run --then /post-merge-cleanup` pushes onto the held branch and marks the body. Then do a cold read of the new SKILL.md (tf SKILL.md rules: standalone, stranger-readable).

### Draft SKILL.md (~250 words)

```md
---
name: post-merge-cleanup
description: Write what merged work decided and taught into the project's knowledge files, in a pull request a person reviews.
disable-model-invocation: true
---

Write down what merged work decided and taught. Nobody will answer you: never ask, decide yourself.

The work is what follows the command: pull request numbers, or the id of an agent run. When nothing follows it, it is every pull request merged since the start of the last run of this command with nothing after it that ended done, as the project's record of agent runs shows, or in the last 24 hours when there is no such run. Skip a pull request that only updates the knowledge files, or whose body has the line `Post-merge cleanup done.`. If the work cannot be read, show an error to the user saying why and stop. If there is none, say so and stop.

Read each pull request's changes and discussion and, for a run, what it was asked and what its agent said. Bring the knowledge files up to date, creating a missing one: `knowledge-base/DECISIONS.md`, the decisions taken and why; `knowledge-base/FACTS.md`, the non-obvious facts; `knowledge-base/INSIGHTS.md`, the insights. Write only what a future agent needs and cannot get from the code, and nothing the files already say. If nothing is worth writing, commit nothing.

Given pull requests, or nothing: open a pull request of your own, its body naming the ones it covers, and leave the merge to a person.

Given a run's id: you are on its branch, and its pull request waits for you to merge. Push your commit onto that branch, open no other pull request, arm no merge, then add the line `Post-merge cleanup done.` at the end of its body, keeping the rest.

Your last message names each pull request covered and what you wrote.
```
