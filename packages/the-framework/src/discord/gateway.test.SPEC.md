The tests drive the whole connection protocol against a fake socket: connecting and identifying, heartbeats and dropping an unresponsive connection, resuming vs. starting fresh, backed-off retries for failing connections (including one that cannot even open), ignoring bot messages, the missing-permission hint for empty message text, and that stop is final.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
