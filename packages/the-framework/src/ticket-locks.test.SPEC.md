Covers ticket claiming: one lock per ticket committed as a single batch and pushed to the default branch, already-claimed or already-planned tickets skipped rather than overwritten (an implementing batch skipping only on the claim, since the plan is its input), rollback when the commit fails, the batch kept (and said out loud) when only the push fails, no push from a feature branch, a failed release restoring the lock whole — on disk and in the git index — and the daemon freeing an abandoned claim only while it still names the exact agent it was made for.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
