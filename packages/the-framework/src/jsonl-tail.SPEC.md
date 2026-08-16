Follows an append-only line-per-record log as it grows — the seam through which agents, daemon, and dashboard talk via files rather than direct connections.

## TLDR

- Reads only what was appended since last time, holds back a half-written line until it completes, and starts over when a fresh agent truncates the log.
- A tail can follow its log to a new home when the file is moved with content intact, without replaying what it already delivered.
- Watches the directory for low latency with a polling backstop for reliability; nothing that goes wrong in either may crash the process, and a tail can opt out of keeping the process alive so steering never holds a finished agent open.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
