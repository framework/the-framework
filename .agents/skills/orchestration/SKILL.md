---
name: orchestration
description: "Split your task across subagents: plan it, get the person's yes, start other agents on the parts, each in its own checkout on a branch started from yours, and land their work on your branch."
---

# Orchestration

A subagent is another coding agent you start on one part of your task: it works alone, in its own checkout. Use the `orchestration` command, a dependency of this repository (`@gemstack/skill-orchestration`), run as `npx orchestration`. When that fails for a missing `node_modules`, install with the lockfile's package manager (`npm install` for `package-lock.json`) and run it again.

```
npx orchestration plan <file>    save the file as your plan; answers the `question` to ask the person
npx orchestration start "<task>" [--model <id>] [--driver <claude-code|codex>]
                                 start a subagent on the task; answers its id at once, without waiting for it
npx orchestration list           your subagents, newest first, as one JSON array
npx orchestration read <id>      one subagent: its `status`, and once it ended its `branch` and `result`, its last reply
npx orchestration stop <id>      stop a subagent that is running
npx orchestration land <id>      merge an ended subagent's branch into yours, then delete that branch
```

A refusal exits 1 with a line on stderr saying why.

## Plan first

Before any subagent, write your plan to a markdown file outside your checkout: one heading per task and, under it, what to change, how to check it, and which tasks must land first. Save it with `plan <file>`. Then show the plan in your reply and ask the person with this block as the very last thing in it, `<question>` being the `question` the command answered, copied exactly:

```await-choices
{ "title": "<question>", "options": [{ "label": "Approve" }, { "label": "Change the plan" }], "recommended": "Approve" }
```

End your reply there. `start` is refused, `no-plan` or `not-approved`, until the person chose Approve for the plan as it is saved: after any other answer, or any change to the plan, save it and ask again.

## Start

Commit first: a subagent's branch starts from your branch's last commit, and `start` answers `uncommitted: true` when your checkout holds changes it will not have. Quote the task as one argument, and write it for a reader who knows nothing of your conversation: what to change, where, and how to check it. The command adds the rest: the subagent commits to its branch, opens no pull request and asks nobody. Pass `--driver` or `--model` only when your task names one. A task that needs another task's work starts once that one is landed.

## Then end your reply

After starting the subagents, end your reply: do not wait, sleep or poll `list`. Each time a subagent ends you get a message, sent by the program that ran it and not by the person, that begins `The run <id>, started for this run, ended <status>`. The status is `done`, `failed`, `stopped`, or `waiting`: it stopped on a question nobody can answer, so treat it as failed. The message gives the subagent's last reply and, when one is left, the branch its work is on. Go on from there: land the work, start another subagent, or end your reply again while others still run.

## Land

`land <id>` merges the subagent's branch into yours and deletes it, here and on origin, so commit your own changes first. Refused `conflict`, with the `files`: run the `git merge` the refusal names, resolve, commit, and `land <id>` again.

Open no pull request until every task is landed. Then publish your branch as one pull request, the way this project publishes work, with the tasks listed in its body.
