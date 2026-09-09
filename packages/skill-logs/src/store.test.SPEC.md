What the tests cover: the branch-bound reads and writes for a long-lived process, against real git with a bare origin.

- **Recording** - a run lands as its card and diary under the directory of the person the repository commits as (lowercased), as one pushed commit named after the run, leaving the checkout clean; the diary is one object per line.
- **Listing and finding** - newest first; a cutoff keeps the runs started at or after it; a run is found by id with its card, its two files' paths and its diary — `[]` for a run with no diary file, none for an id no run has or that is not an id.
- **Patching** - the branch and the pull request land on the card as one pushed commit, and survive the next sync of the branch; a run that is not there patches nothing.
- **Deleting** - both files go as one pushed commit; a run already gone is a landed no-op.
- **Recording again** - a run another person recorded, ended by this machine, stays under that person; a card that does not parse is skipped by the listing; an id that is not one is refused unwritten.
- **No remote** - a run is recorded locally and the push is reported as not done; a project with no checkout has no runs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
