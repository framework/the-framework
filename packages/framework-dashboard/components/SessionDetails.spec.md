The session-details strip behind the action bar's disclosure: which agent ran the session and its cumulative spend, folded from the #322 usage events.

## TLDR

- Facts row: Agent (via `agentForDriver`/`AGENT_LABELS`, falling back to the raw driver name), Model (#1438: the current leg's model id from `sessionInfo`, hidden when unrecorded), Spent ($ when `costUsd` reported), Tokens in/out, Cache read/write (only when non-zero), Turns — or "No spend reported yet".
- `lastUsage()` scans events backwards for the latest cumulative `usage` event; `compact()` formats 1234 → "1.2k", 1_200_000 → "1.2M".
- Always available (the chevron no longer pops in and out with git/handoff data); branch/PR/changes are NOT repeated here — the bar row above owns them.
