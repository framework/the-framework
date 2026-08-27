What the tests cover: the cloud scratch-ref sweep's deletion gates and its bookkeeping, against a scripted origin.

- Only the driver's exact `cloud-<counter>-<8 hex>` naming and agent branches are candidates; a user's own `cloud-…` branch, `claude/*` branches, `tf-<session name>` branches, and agent branches whose age cannot be read from their name are never considered.
- An aged agent branch whose work is on the default branch is deleted; one inside the safe age, or belonging to an agent the daemon is still responsible for, is kept.
- A tip not provably on the default branch is kept as possibly holding work, and no PR lookup is spent on it; an open PR keeps a ref while a closed one does not.
- A hand-off anchor tip (empty commit on a landed parent) counts as holding no work and its ref is deleted; a tip that changes something against its parent is kept.
- A `cloud-*` ref is aged from when this machine first saw it: first sight only records the time; watched past the safe age it is deleted and its record removed with it; watched less, it stays. A record for a ref no longer on origin is pruned, and a deletion the remote refuses keeps its record so the retry does not restart the day.
- A repo with no reachable remote sweeps nothing and never throws; a repo whose default branch is neither `main` nor `master` still works, because the remote itself names the default.
- The daemon-service wrapper sweeps every project, logs only deletions and failures (kept refs stay quiet), and a stopped service ticks as a no-op.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
