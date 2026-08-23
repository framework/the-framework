The drain-queue preset: takes exactly one task off the agent queue and works it. The agent opens `TODO_AGENTS.md`, works on the first open entry only, checks that entry off once the work is done and published, and starts no other entry.

## Business logic

### One entry per agent

#### User story

The daemon drains the agent queue by starting agents against it, and the user watches each queued task become its own pull request. An agent that swept several entries at once would fold unrelated tasks into one branch and one review.

#### Business logic

The preset is deliberately singular: the first open entry, and nothing else. The entry is checked off only after the work is done *and* published, so an entry that never landed stays on the queue for the next drain to pick up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
