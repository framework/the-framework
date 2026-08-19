Deletes the two dead refs every Claude-web hand-off leaves on origin — the pre-hand-off `cloud-*` ref and the run branch — once it is provably safe, so they stop accumulating one pair per web run.

## TLDR

- A web run pushes a `cloud-*` ref for the cloud session to clone at; the session then works on its own branch and opens its PR from there, so nothing ever consumes the ref again. Run branches used to reach origin too, pushed empty when a web run's worktree was reclaimed — teardown no longer pushes them, and the sweep clears the ones already there.
- The driver must not delete its own ref: it only learns "session created", never "clone finished", and a ref deleted in between strands the session. So the daemon sweeps instead, hourly, and waits out the race.
- A ref goes only when every gate clears: it is about a day old, its commits are already on the default branch (the proof it holds no work — this is what protects a local run's branch carrying unmerged commits), it has no open pull request, and its agent is not one the daemon is still running.
- The hand-off anchor is the one tip the default branch never absorbs — an empty commit no merge ever lands — so it clears the work gate its own way: a tip that changes nothing against its parent, on a parent that landed, holds no work.
- A run branch's age is in its name; a `cloud-*` ref's is not, so the sweep remembers when it first saw one and ages it from there — which also keeps refs pushed by another machine safe, since each machine only deletes what it has itself watched for a day.
- Conservative and quiet: anything unprovable simply stays for the next pass, and only actual deletions (and failures) are announced.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
