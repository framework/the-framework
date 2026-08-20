Serializes everything that touches one agent's checkout, so a finishing agent's cleanup and a user action on the same agent (push, open a pull request, remove, resume) never run git against the same checkout at once.

## Flows

- A failed holder surfaces its own error without blocking whoever waits behind it.

## Rationales

- Without the lock, whichever actor loses the race reports a bogus failure or leaves a checkout behind that should have been removed.
- Both actors live in the daemon by design, so an in-process lock is the whole fix — there is no second process to coordinate with.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
