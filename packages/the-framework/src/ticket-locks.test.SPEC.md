What the tests cover: ticket claiming and releasing through the data branch's write funnel.

- A batch writes one `.lock.md` per assigned ticket with the `CLAIMED: <agent id>` line, and its commit message counts the batch.
- A ticket already locked by someone else is skipped without overwriting; a planning batch also skips a ticket that already has a plan, while a drain batch claims a planned ticket (the plan is its input) and skips only on an existing lock.
- A cycle that could not commit claims nothing, restores the files, and logs the error even when the batch is empty; a cycle that committed but could not push keeps its claims and logs that other machines cannot see them.
- A re-run of the cycle (the funnel losing a push race) re-judges the batch from scratch instead of double-claiming, producing one claim and one commit message.
- The default write creates `tickets/` when the checkout has none.
- A release frees the lock with a commit message naming the ticket; releasing an unclaimed ticket reports no lock and commits nothing; a cycle that could not land reports an error and leaves the lock in place; one that committed but could not push stands and logs the gap.
- A held-by release frees only a lock naming that exact agent (with its own "ended with nothing to hand off" message), leaves anyone else's claim untouched, and reports no lock when the file is already gone.
- The claim line is read correctly: valid claims yield their holder, and non-claim content, an empty claim, or an empty file name no holder; a ticket filename maps to its `.lock.md` sibling.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
