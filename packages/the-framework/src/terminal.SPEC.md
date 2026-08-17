Renders the agent's event stream as one human-readable terminal line per event — the CLI's counterpart to the dashboard's views over the same stream.

## TLDR

- Consequences over flags: the handoff line says what will happen ("push the branch, open a PR, and merge it"), and every merge outcome is spoken — after "auto-merge is on", silence would read as "it merged".
- Refusals are phrased as reasons in the reader's terms (why a merge was withheld, why the handoff or cleanup did nothing), so a setting never reads as a bug.
- A driver that reports no price shows its token counts rather than a $0 that would read as free.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
