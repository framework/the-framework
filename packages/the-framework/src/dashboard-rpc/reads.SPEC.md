Every read the dashboard makes: agents and their history, docs, tickets and queues, cross-project rollups, files and diffs, and where a finished agent's work stands.

## TLDR

- Everything is a projection of files the agents and daemon already write — the dashboard holds no state of its own — and an unknown project or a host with no checkout gets empty results, never errors.
- The agent list merges archived, live, and device-relayed agents; a live copy wins a tie, so a continued agent reads as running rather than as its finished first leg, and a relayed one survives a reload despite existing only in memory.
- Agent-scoped reads (files, diffs, git status, what changed) look at that agent's own checkout and are filtered to its lifetime, so an agent on a reused branch never wears a predecessor's PR; changes come from git, not from watching the agent's tools — verify by outcome.
- The handoff read asks the agent's branch — the thing that outlives it — taking only uncommitted work from the checkout, and only when that checkout is genuinely the agent's own.
- The bridge reads report what the browser extension saw of a Claude web session: its parked question, the picked answer's fate, and whether the extension has made contact at all.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
