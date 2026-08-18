Covers the backlog loop and queue plumbing: draining one entry per turn to empty, the per-item gate and stopping, the stall and item-cap limits, gates and signals honored mid-backlog with ready-for-merge deduped to once, priority-section placement of queued entries, naming the ticket a drain agent will pick up, and the agent-TODO merge safety belt.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
