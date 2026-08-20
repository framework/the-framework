Deletes the dead refs web runs leave on origin — the `cloud-*` ref a hand-off pushes for the session to clone at, and any run branch that holds no work — once it is provably safe, so they stop accumulating.

## Flows

- A web run pushes a `cloud-*` ref for the cloud session to clone at; the session then works on its own branch and opens its PR from there, so nothing ever consumes the ref again. A web run's own branch never reaches origin — its checkout is reclaimed without a push once the cloud session has what it needs — while a local run's branch does, and is swept only once its work has landed.
- The daemon sweeps hourly; the driver that pushed a ref never deletes it itself.
- A ref goes only when every gate clears: it is about a day old, its commits are already on the default branch, it has no open pull request, and its agent is not one the daemon is still running.
- The hand-off anchor is the one tip the default branch never absorbs — an empty commit no merge ever lands — so it clears the work gate its own way: a tip that changes nothing against its parent, on a parent that landed, holds no work.
- A run branch's age is in its name; a `cloud-*` ref's is not, so the sweep remembers when it first saw one and ages it from there.
- Conservative and quiet: anything unprovable simply stays for the next pass, and only actual deletions (and failures) are announced.

## Rationales

- The driver must not delete its own ref: it only learns "session created", never "clone finished", and a ref deleted in between strands the session — so deletion falls to the daemon's later sweep, which waits out the race.
- The commits-already-on-the-default-branch gate is the proof a ref holds no work; it is what protects a local run's branch carrying unmerged commits.
- First-seen ageing also keeps refs pushed by another machine safe: each machine only deletes what it has itself watched for a day.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
