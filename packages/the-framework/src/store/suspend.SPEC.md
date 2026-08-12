A shutting-down daemon writes down which sessions were mid-flight, so the next boot can pick the work back up.

## TLDR

- Resumable only for a day: a restart continues the work, but a machine that was off for a week must not wake up spending quota on work whose repo has moved on — older entries are dropped, not resumed.
- The queue claim a session held rides along verbatim, so a resumed session keeps its claim and no second agent is put on the same work.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
