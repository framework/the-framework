Reduces everything an agent has reported to the single word its status pill shows — one agent, one word, the same in the session toolbar and on the overview.

## Flows

- An agent can hold several facts at once (it can say ready-for-merge and then fail), so a ranking picks the word: how it ended outranks anything it said on the way, because a green "ready for merge" must never describe an agent that then failed or was stopped.
- Between a clean end and the report that publishing finished, the pill says "publishing…" — pushing, opening the PR, or merging is what is actually happening then.
- It pulses "building…" only while the agent is live, and says nothing until the agent has said something. A resume starts the ranking over, so an earlier stop or an earlier publish never sticks to the resumed run.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
