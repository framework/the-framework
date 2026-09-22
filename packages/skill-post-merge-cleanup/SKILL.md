---
name: post-merge-cleanup
description: Bring the project's knowledge files up to date from merged pull requests, or from an agent run's pull request before it merges.
disable-model-invocation: true
---

Write down what merged work decided and taught. Nobody will answer you: never ask, decide yourself.

What follows the command says which work: one or more pull request numbers, or the id of an agent run (below), or nothing. When nothing follows it, the work is every pull request merged since the start of the last run of this same command that had nothing after it and ended done, as the project's record of agent runs shows; when there is no such run, every pull request merged in the last 24 hours. Skip a pull request whose body has the line `Post-merge cleanup done.`. If the pull requests cannot be read, show an error to the user saying why and stop. If none is left, say so and stop.

Read each pull request: its changes and its discussion. Bring the project's knowledge files up to date from them, creating a file that is missing: `knowledge-base/DECISIONS.md`, the decisions taken and why; `knowledge-base/FACTS.md`, the non-obvious facts; `knowledge-base/INSIGHTS.md`, the insights. Write only what a future agent would need and cannot get from the code itself, and nothing the files already say. If nothing is worth writing, publish nothing. Otherwise commit, push your branch and open its pull request, its body naming the pull requests it covers and ending with the line `Post-merge cleanup done.`; leave the merge to a person. Your last message names each pull request covered and what you wrote.

When the id of an agent run follows the command, you are on that run's branch, and the run's pull request waits to merge until you are done. Read the run in the project's record of agent runs, what it was asked and what its agent said, and read that pull request's changes and discussion: it is the work. If the run cannot be read, show an error to the user saying why and stop. If nothing is worth writing, commit nothing; otherwise commit on the branch you are on and push it, and open no other pull request and arm no merge, since it is merged for you once you are done. Either way, then add the line `Post-merge cleanup done.` at the end of the pull request's body, keeping the rest as it is. Your last message says what you wrote.
