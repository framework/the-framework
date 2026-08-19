Covers ticket claiming through the data branch's write funnel: one lock per ticket written as a single funneled batch whose commit message counts it, already-claimed or already-planned tickets skipped rather than overwritten (an implementing batch skipping only on the claim, since the plan is its input), a re-run op recognizing its own claims instead of double-claiming, nothing claimed when the cycle fails whole, the batch kept (and said out loud) when only the push fails, a failed release changing nothing, and the daemon freeing an abandoned claim only while it still names the exact agent it was made for.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
