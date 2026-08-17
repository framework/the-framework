Reduces everything an agent has reported to the single word its status pill shows — one agent, one word.

## TLDR

- An agent can hold several facts at once (it can say ready-for-merge and then fail), so a ranking picks the word: how it ended outranks anything it said on the way, because a green "ready for merge" must never describe an agent that then failed or was stopped.
- Between a clean end and the report that publishing finished, the pill says "publishing…" — pushing, opening the PR, or merging is what is actually happening then.
- It pulses "building…" only while the agent is live, says nothing until it has said something, and a resume starts the ranking over, so an earlier stop or an earlier publish never sticks to the new leg.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
