What the tests cover: claiming and releasing tickets through a caller's write cycle, with the cycle's outcomes scripted.

- **A batch of claims** - one `.lock.md` per claim naming its holder, landing as one commit; the commit names the ticket for a single claim and the count for several.
- **The two sides of a ticket's life** - a claim made to plan skips a ticket already claimed and a ticket already planned; a claim made to implement takes the planned one, and only an existing claim skips it.
- **A cycle that could not land** - nothing claimed, nothing written, and the reason logged.
- **A cycle that committed but could not push** - the claims are kept, and the gap the other machines have is logged.
- **A re-run** - the cycle re-applying the same change re-judges the batch instead of claiming twice, and still lands as one commit.
- **The folder is created when the checkout has none** - a real filesystem write puts the lock under `tickets/`.
- **Releasing** - the lock is deleted and the commit says so; no lock is reported as such, with nothing committed; a cycle that could not land reports an error and leaves the lock in place; one that committed but could not push still counts as released, and logs the gap.
- **Releasing on behalf of a named holder** - the exact claim named is freed, someone else's is refused as not the holder's with nothing committed, and a claim already gone is reported as no lock.
- **Reading a lock** - the claim line gives its holder, whitespace and a parenthesised suffix included; a plan's prose, an empty claim line and empty content name nobody.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
