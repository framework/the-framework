Resolves an agent's settings across configuration tiers — this agent's own say, then the project's, the repo's, the account's — where the nearest tier that set something wins and a tier that said nothing does not participate.

## User Stories

- The user sets an option on one agent and it wins over the same option set for the project, the repo, or the account — an explicit off included.
- The user who configures nothing still gets finished work handed back: the defaults open a draft pull request.
- The user reads, for each setting the agent ran with, which tier decided it.

## Flows

- An explicit off in a nearer tier beats an on in a farther one.
- Nobody setting anything resolves to the shipped defaults: a finished agent hands itself back by opening a draft pull request, and merging is the one rung above that.
- Each settled key remembers which tier decided it, so the agent can say out loud where every setting came from.

## Rationales

- Nearest-tier-wins rather than combining tiers with "or": "or" could only ever turn things on — no tier could say no.
- Merging sits one rung above the default because landing on the default branch is not reversible the way publishing a branch is.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
