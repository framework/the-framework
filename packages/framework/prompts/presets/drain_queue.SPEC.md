The drain-queue preset: takes exactly one task off the agent queue and works it. The agent reads the queue with the `tickets` skill's command, works on the first open entry only, takes that entry off the queue with the same command once the work is done and published — an entry that is done is deleted, not marked — and starts no other entry, so each queued task becomes its own agent, its own branch and its own pull request, and an entry whose work never landed stays on the queue for the next drain to pick up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
