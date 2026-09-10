What the tests cover:

- **One claim per ticket, one commit** - a batch writes one `.lock.md` per ticket holding `CLAIMED: <holder>` and lands as one commit, "claim 2 tickets" for several tickets and "claim tickets/<stem>" for one.
- **Claiming to plan versus to implement** - a claim to plan skips a ticket someone else holds and a ticket that already has a plan, writing no claim for either; a claim to implement skips only the held ticket and takes the planned one.
- **A batch that could not commit** - claims nothing, leaves no claim file behind, and logs the reason.
- **A missing `tickets/` directory** - writing a claim creates the directory when the checkout has none.
- **Committed but not pushed** - the batch keeps its claims and the gap toward other machines is logged.
- **A re-applied batch** - applying the same batch twice, as after a lost push race, leaves one claim naming the holder and one commit, never a double claim.
- **Releasing** - a release removes the claim and lands as "release tickets/<stem>"; a ticket with no claim reports "no-lock" and commits nothing.
- **A release that could not land** - one that could not commit reports an error and leaves the claim in place; one committed but not pushed stands, the claim gone and the gap logged.
- **A release naming its holder** - frees exactly the claim naming that holder, leaves anyone else's untouched with "not-holder" and nothing committed, and reports "no-lock" when the claim is gone.
- **Reading the claim line** - the holder is read back from `CLAIMED: <holder>`, leading blank lines skipped and spaces inside the name kept; a plan-like text, a bare `CLAIMED:` and an empty file name no holder.
