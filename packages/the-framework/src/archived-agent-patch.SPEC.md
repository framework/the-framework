Records a late fact onto a finished agent's archive — its record on the data branch — by putting the patch through the daemon's single data-branch write cycle: sync with origin, apply, commit, push. Adoption uses this to record a cloud session's actual branch and PR onto the waiting agent's archive.

The funnel is the point: a patch written straight into the data checkout is not a fact yet — the next sync refuses a dirty tree and hard-resets it, so the edit would vanish within a minute without any other machine ever seeing it. The outcome is true when the record now carries the patch, committed; a push that could not go out rides the next cycle, per the funnel's own owed-push rule. An agent with no archive to patch reports false, and nothing is committed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
