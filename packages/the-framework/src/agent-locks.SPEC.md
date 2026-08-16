Serializes everything that touches one run's checkout, so a finishing run's cleanup and a user action on the same run (push, open a pull request, remove, resume) never run git against the same checkout at once.

## TLDR

- Without it, whichever actor lost the race reported a bogus failure or left a checkout behind that should have been removed.
- Both actors live in the daemon by design, so an in-process lock is the whole fix — there is no second process to coordinate with.
- A failed holder surfaces its own error without blocking whoever waits behind it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
