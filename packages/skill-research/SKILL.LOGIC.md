The `research` command skill: a skill file the coding agent's harness expands from `/research`, the prompt of the agent a person starts for rating how obviously well a part of the code solves each problem it solves, and naming the problems worth researching alternatives for; it changes nothing. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/research` and, after it, the part of the project to review. The agent lists every high-level flow the part implements, rates each from 0 to 10 for how obviously optimal its solution is, with a reason, and ends on a written result: the ratings, lowest first, and the low-rated problems worth a deep-dive into alternative solutions. It changes nothing; the person decides what comes next.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Problem variability** - every problem the part solves, rated from 10 (solved in an obviously optimal way) to 0 (highly unclear whether it could be solved better), each with its reason.
- **The deep-dives** - the low-rated problems are named as worth a deep-dive into alternative solutions, each with what that deep-dive should look at.
- **Changes nothing** - no file, no commit, no ticket, no queue entry: the written result is the agent's last message, which the run's record keeps, and a person decides what comes next.
