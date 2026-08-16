Reduces everything a session has reported to the single word its status pill shows — one session, one word.

## TLDR

- A session can hold several facts at once (it can say ready-for-merge and then fail), so a ranking picks the word: how the session ended outranks anything it said on the way, because a green "ready for merge" must never describe a session that then failed or was stopped.
- Between a clean end and the report that publishing finished, the pill says "publishing…" — pushing, opening the PR, or merging is what is actually happening then.
- It pulses "building…" only while the session is live, says nothing until the session has said something, and a resume starts the ranking over, so an earlier stop or an earlier publish never sticks to the new leg.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
