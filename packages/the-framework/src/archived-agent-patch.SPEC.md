Records a fact learned about a run after it ended — the pull request its work is on, the branch a cloud session landed it on — onto the run's archived record, as a commit on the data branch (`tf-data`, the shared branch where agent records are archived).

## Flows

- The write goes through the data branch's one write funnel — sync with origin, patch, commit, push — so the fact is shared with every machine and survives the next sync.

## Rationales

- The write funnel is the only durable path: written straight into the data branch's checkout, the fact would be wiped within a minute, since the sync hard-resets a dirty checkout.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
