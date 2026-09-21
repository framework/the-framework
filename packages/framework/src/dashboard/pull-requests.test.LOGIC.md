What the tests cover, against a stand-in forge provider that answers the pull requests it is told and records what it was asked:

- **The shapes** - a provider's request becomes a linked pull request with its state upper-cased and its head commit as `headRefOid`; a creation time or head the provider answered empty is absent rather than present and empty; a draft becomes an open pull request with its draft flag, head branch and creation time.
- **A branch's history** - the provider is asked for that branch in every state; the pull requests come back newest first and the newest is the branch's pull request; a project with no forge has no history, for the forgiving read and the strict one alike, not a failure; a cached read with no branch to ask about answers nothing, not pending.
- **A forge that could not answer** - reads as no history for the panels, and as a failure carrying the provider's own error for a caller about to open a pull request.
- **The open pull requests** - the provider is asked by the open state; a provider that could not answer is a failure, never an empty queue; a project with no forge has none open.
