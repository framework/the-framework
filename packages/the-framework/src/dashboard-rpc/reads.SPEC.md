Every read the dashboard makes: agents and their history, docs, tickets and queues, cross-project rollups, files and diffs, and where a finished agent's work stands.

## User Stories

- The user sees every project's agents and their history, docs, tickets, queues, and cross-project rollups in one dashboard.
- The user browses an agent's files, diffs, and git state and sees exactly what that agent changed — no other agent's, and no predecessor's.
- The user sees where a finished agent's work stands: the branch it left, and what is committed, pushed, or opened as a PR.
- The user follows a Claude web session through the browser extension's eyes: its parked question and the fate of the picked answer.

## Flows

- Everything the user sees is a projection of files the agents and the daemon already write — the dashboard holds no state of its own. An unknown project or a host with no checkout gets empty results, never errors.
- The agent list merges archived, live, and device-relayed agents. A live copy wins a tie, so a continued agent reads as running rather than as its finished first leg; a relayed agent survives a reload despite existing only in the daemon's memory.
- What the user browses of an agent — files, diffs, git status, what changed — is read from that agent's own checkout and filtered to its lifetime, so an agent on a reused branch never wears a predecessor's PR. Changes come from git, not from watching the agent's tools: verify by outcome.
- Where a finished agent's work stands is asked of the agent's branch — the thing that outlives it; only uncommitted work is taken from the checkout, and only when that checkout is genuinely the agent's own.
- The bridge reads report what the browser extension watching claude.ai saw of a Claude web session: its parked question, the picked answer's fate, and whether the extension has made contact at all. The token the user pastes into the extension during setup is handed out only while the bridge is switched on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
