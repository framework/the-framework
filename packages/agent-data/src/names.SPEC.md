The two names every consumer of the package builds on, defined once: `.branches`, the directory at a project's root where every checkout lives — the data branch's persistent checkout beside the agents' own — and `agent-data`, the shared data branch every skill keeps its files on, a path per skill. Both are reachable without pulling in git, so code that runs in a browser can name them too.

## Rationale

The directory is dotted so that tools run in the project — a type-checker's `**/*`, a test runner's glob, a formatter — never descend into the checkouts: a leading dot is what `*` does not match, and it is the one thing that keeps N copies of the repository out of every tool that does not read git's ignore rules.

The branch is named here and nowhere else: every skill already depends on this package, so one exported constant is what keeps four packages from each spelling the name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
