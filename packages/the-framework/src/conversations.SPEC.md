The committed conversation record: one markdown file per run holding what the human asked and what the agent answered, kept in the project's Git repo so a clone carries the chat and not just the fact a run happened.

## TLDR

- Deliberately the readable chat, not the verbose tool-call transcript — that stays with the model provider; what lands here is what a person would reread.
- One file per run, so concurrent runs never produce merge conflicts; the run id ties the chat back to the project's log.
- Each turn records who spoke, when, and through which surface (dashboard, Discord, ...), and reads back oldest-first, like a transcript.
- Message bodies stay multi-line and diff-readable; only what could forge a new message heading is escaped, and transport names are validated at the boundary for the same reason.
- Appending lazily upgrades the repo's ignore rules, so projects activated before this feature existed still commit their conversations instead of silently dropping them.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
