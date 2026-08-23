Reads a project's own committed configuration — `the-framework.yml` (or `.yaml`) at the repository root — so that settings which are facts about the repository travel with the code instead of being chosen again for every agent.

## Business logic — TL;DR

- **Three settings, and only what the file names** - the built-in system prompt switch (`vanilla`), transparent mode, and how far a finished agent publishes itself (`handoff`). A setting the file omits stays undecided, leaving it to the other configuration tiers.
- **A missing file is not a configuration** - no file at either spelling means no settings, which is the ordinary zero-config case.
- **A malformed file warns, never fails an agent** - an unreadable or invalid file is reported and treated as empty.
- **The publish ladder is checked by value** - `handoff` must name one of the real rungs, and anything else is an error rather than a silently ignored setting.

## Business logic

### What a project can commit

#### User story

A repository that should always run its agents raw, or should never open pull requests of its own, says so once in a file its contributors can read and review, rather than every user re-choosing it in the dashboard.

#### Business logic

The file carries three settings. `vanilla` removes The Framework's built-in system prompt while keeping the session controls. `transparent` makes every agent in the project a raw wrapped agent — no framework prompt, no protocols, no dashboard, no backlog loop. `handoff` names how far a finished agent publishes itself, one of `local`, `push`, `pr` or `merge`.

Both spellings of the file name are accepted, `.yml` first. The first one that exists is the one used.

#### Rationale

`merge` has to be asked for out loud, which is why it is a rung above the default rather than the default: publishing a branch is reversible, landing it on the default branch is not. It is meant for work whose review already happened before the agent ran — the routines that merge what a plan the user could veto already settled.

### Reading the file cannot fail an agent

#### User story

A user's agent must not refuse to run because of a stray character in a config file.

#### Business logic

An absent file yields no settings at all, and so does an empty document. A file that is not a map of settings, a `handoff` that does not name a real rung, or a mode setting that is not a true/false value is an error naming the file and the offending setting; that error is reported as a warning and the file is treated as carrying nothing.

#### Rationale

The publish ladder is validated by its values rather than merely by its type, because a typo — or a leftover `handoff: true` from when this was a switch — must be an error rather than a silently ignored rung that leaves the repository publishing more than its file says.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
