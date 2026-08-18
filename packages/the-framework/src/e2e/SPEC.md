The product's end-to-end stories: each test walks a user journey through the daemon's real business logic — real spawned agent processes, real git repos, the same calls the dashboard makes — with only the coding-agent CLI replaced by the deterministic fake driver, so the whole lifecycle is provable offline.

## TLDR

- Four story files cover the journeys: the agent lifecycle (start, watch live, read the archived row, publish the branch), steering and gates (questions, chat, handoff, stop), projects and settings, and tickets and the work queue.
- Stories observe the product exactly where users do — the dashboard's reads and the live event feed; the one extra window is the recorded child invocation, since a detached spawn is otherwise unobservable.
- The harness gives every story a throwaway world with its own global state and a daemon-shaped teardown, so stories are isolated, parallel-safe, and repeatable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
