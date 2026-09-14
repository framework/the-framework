What the tests cover, with real git:

- **No branch, no head** - a repository without an `agent-data` branch has no head to read.
- **Signed commits do not count as moves** - a plain write (someone queued work) moves the branch; a write through the daemon's funnel lands as a commit whose message ends in a blank line and `Daemon: <host>`, and counts as no move; an unsigned write after it counts as one, over either range; a message that merely mentions the word in prose is not a trailer and counts as a move.
- **A range git cannot walk** - counts as no move.
