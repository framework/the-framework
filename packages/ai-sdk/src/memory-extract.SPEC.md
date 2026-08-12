After a conversation turn completes, a small model distills durable facts about the user and saves the confident ones to memory.

## TLDR

- Only the latest user-and-assistant exchange is examined; the small model self-rates each candidate fact's confidence, and anything below the threshold is discarded.
- Runs only after a successful turn — failed runs never write memory — and any failure inside the extraction itself is swallowed, so remembering can never break the actual conversation.
- Auto-installed when an agent declares automatic extraction; auto-installs skip continuation calls so resumed runs don't extract twice.

## Rationales

- The confidence threshold is the first defense against a user planting adversarial "facts"; an audit hook exposes exactly what was written for production monitoring.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
