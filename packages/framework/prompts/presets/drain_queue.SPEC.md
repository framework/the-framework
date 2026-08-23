The drain-queue preset: takes exactly one task off the agent queue and works it. The agent opens `TODO_AGENTS.md`, works on the first open entry only, checks that entry off once the work is done and published, and starts no other entry — so each queued task becomes its own agent, its own branch and its own pull request, and an entry whose work never landed stays on the queue for the next drain to pick up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
