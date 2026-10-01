---
name: orchestration
description: "Split your task across subagents: start other agents on parts of it, each in its own checkout on a branch started from yours, and go on when they end."
---

# Orchestration

A subagent is another coding agent you start on one part of your task: it works alone, in its own checkout. Use the `orchestration` command, a dependency of this repository (`@gemstack/skill-orchestration`), run as `npx orchestration`. When that fails for a missing `node_modules`, install with the lockfile's package manager (`npm install` for `package-lock.json`) and run it again.

```
npx orchestration start "<task>" [--model <id>] [--driver <claude-code|codex>]
                                 start a subagent on the task; answers its id at once, without waiting for it
npx orchestration list           your subagents, newest first, as one JSON array
npx orchestration read <id>      one subagent: its `status`, and once it ended its `branch` and `result`, its last reply
npx orchestration stop <id>      stop a subagent that is running
```

A refusal exits 1 with a line on stderr saying why.

## Start

Commit first: a subagent's branch starts from your branch's last commit, and `start` answers `uncommitted: true` when your checkout holds changes it will not have. Quote the task as one argument, and write it for a reader who knows nothing of your conversation: what to change, where, and how to check it. The command adds the rest: the subagent commits to its branch, opens no pull request and asks nobody. Pass `--driver` or `--model` only when your task names one.

## Then end your reply

After starting the subagents, end your reply: do not wait, sleep or poll `list`. Each time a subagent ends you get a message, sent by the program that ran it and not by the person, that begins `The run <id>, started for this run, ended <status>`. The status is `done`, `failed`, `stopped`, or `waiting`: it stopped on a question nobody can answer, so treat it as failed. The message gives the subagent's last reply and, when one is left, the branch its work is on. Go on from there: take the work with `git merge <branch>`, start another subagent, or end your reply again while others still run.
