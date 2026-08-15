Resolves a run's settings across configuration tiers — this run's own say, then the project's, the repo's, the account's — where the nearest tier that set something wins and a tier that said nothing does not participate.

## TLDR

- Built this way because combining tiers with "or" could only ever turn things on: no tier could say no; now an explicit off in a nearer tier beats an on in a farther one.
- Nobody setting anything resolves to the shipped defaults: a finished session hands itself back by opening a draft pull request, and merging is the one rung above that, because landing on the default branch is not reversible the way publishing a branch is.
- Each settled key remembers which tier decided it, so the run can say out loud where every setting came from.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
