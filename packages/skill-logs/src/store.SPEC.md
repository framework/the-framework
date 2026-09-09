Where the runs live, bound to the branch: `agents/<who>/<id>.json` and `<id>.jsonl` at the root of the `agent-data` branch of the project's repository, checked out at `.branches/agent-data` for a long-lived process. This module is that process's side: it reads the checkout and writes through the funnel.

## User story

- The user's daemon records every run it drove the moment the run is over, and the record is on origin before anyone asks for it.
- The user's dashboard lists the project's runs, other machines' included, and opens one to replay it.
- A pull request opened after a run, or the branch a cloud session's work landed on, shows on the run's row.
- The user deletes a run from the dashboard and it is gone for every machine.

## Glossary

- **the funnel** - the caller's write cycle over the branch: apply a change to a checkout of it, commit, push. The default is the persistent checkout's serialized cycle.

## Business logic — TL;DR

- **The seams every operation takes** - plain file operations and the funnel, injected so every operation is testable off disk and git, with the real filesystem and the persistent checkout's cycle as the defaults.
- **Listing and finding** - every person's runs off the checkout, newest first, a card that does not parse skipped, a cutoff by start time; one run's card, its two files, and its diary by id.
- **Recording a run** - the card and the diary as one commit, under the directory of the person the repository commits as, or where the run already sits.
- **Patching and deleting** - two late facts onto a card as one commit; both files removed as one commit.

## Business logic

### The seams every operation takes

#### Business logic

Every operation takes two things it does not own: plain file operations — read, write, delete, list — against whatever directory it is handed, and the funnel. A caller that leaves them out gets the defaults: the real filesystem and the persistent checkout's serialized cycle on the `agent-data` branch. A git runner is a third seam, for the one git question the module asks itself: the email the repository commits as.

### Listing and finding

#### User story

See `## User story`: the dashboard's list and its run page.

#### Business logic

Listing reads every person's directory under the runs directory of the persistent checkout and every card file in each, newest first; a card that does not parse is skipped, and a missing directory is no runs. A cutoff, when given, keeps only the runs whose start time is at or after it. Finding a run by id searches every person's directory for its card file and answers with the card, or with the two files' paths for a caller that needs the file itself, or with the diary's lines — every line, the writer's included — `[]` for a run with no diary file; an id that is not one, or that no run has, is none of these. Nothing here throws.

### Recording a run

#### User story

See `## User story`: the daemon at the end of a run.

#### Business logic

Recording a run writes its card and its diary as one commit through the funnel, under the directory of the person the repository commits as — read from git at the moment of writing, made safe as `run` says. A run that already sits somewhere on the branch, under any person, is written where it sits: a run recorded again — its ending, written by a later process that found it left running — stays in one place. An id that is not one is refused before anything is written. The funnel's outcome says whether the commit landed and whether it was pushed; a push that could not go out rides the next cycle.

### Patching and deleting

#### User story

See `## User story`: the pull request that arrives late, the delete button.

#### Business logic

Patching puts the branch the work landed on, the pull request, or both onto a run's card as one commit, the rest of the card unchanged; it reports whether the card now carries the patch, committed — false when there is no such run. Deleting removes a run's card and diary as one commit; a run that is not there is a landed no-op. Both find the run inside the funnel's cycle, so a cycle re-run after a lost push race looks again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
