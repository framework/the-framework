The autopilot's durable memory: a ledger of the project's settled choices and rejected ideas, kept so a later run stops re-pitching what was already turned down.

## TLDR

- Every decision carries its reason — the "because" is what makes a rejection stick across sessions.
- The ledger lives as DECISIONS.md at the project root, human-readable and hand-editable; the user and the agent share the same file.
- The agent checks the ledger before proposing, records the outcome when an idea is accepted or rejected, and starts each session briefed on everything already rejected.

## Flows

- Before proposing: the agent compares its idea against recorded decisions by word overlap; a match on a rejected one means "already turned down — do not re-pitch".
- On decide: the decision is appended with its reason and the file is saved, so the next session remembers.

## Rationales

- Word-overlap matching is deterministic and cheap, so the check can run before every single proposal; a smarter matcher can replace it later without changing how the rest of the product uses the ledger.
- The file is parsed forgivingly, so a hand edit by the user never breaks the agent's memory.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
