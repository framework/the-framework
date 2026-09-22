Priority: 4
Topics: skills, post-merge-cleanup

# Cut the post-merge-cleanup skill to a third of its length

## TLDR

`packages/skill-post-merge-cleanup/SKILL.md` is 743 words, the longest command skill. It does three jobs in one: it queues a maintainability refactor, it queues a security audit, and it writes the knowledge files. It also has two modes, merged pull requests and an agent run's id, each with its own publishing rules. Cut it to about 250 words, or drop the skill, and keep what a person relies on.

## Why it matters

The skill should be one of a few polished skills, and this one reads as several skills in one. It also has almost no use to learn from: the record of agent runs holds no `/post-merge-cleanup` run, and no `knowledge-base/` folder exists in this repository.

## What a person relies on today

- The launcher's "Post-merge cleanup" box: `run --then /post-merge-cleanup` holds the run's merge, then a second run gets `/post-merge-cleanup <run id>` on the same branch and the merge is released once it ends done (`packages/agent-scheduler/src/run.LOGIC.md` [11]).
- The schedule line in `agent-schedule.md` (`every 1h, when …`, `off`). It picks merged pull requests without the line `Post-merge cleanup done.`, counted from the last done run.
- The landing page's promise: "AI retains knowledge via files such as `knowledge-base/DECISIONS.md`" (`packages/the-framework.ai/pages/index/StopBabysitting.tsx:84`, `YourFramework.tsx:74`).
