The tests cover the persistence promises: events fold into the same snapshot whether appended live or replayed, sessions archive on close and are rescued after a crash, per-user committed archives are listed team-wide and deduplicated, dead sessions are healed everywhere they can be found (the missing ending written into log, snapshot, and archive, while live owners and other machines' sessions are left alone), and continuing a session reopens the same log under its original intent.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
