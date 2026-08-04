The decisions ledger: record settled choices and rejected ideas with their reasons — round-tripped to a human-editable `DECISIONS.md` — so a run stops re-pitching what was already turned down.

## TLDR

- Consult before proposing, append on accept/reject; exposed to agents as two tools (consult, record) plus a briefing prepended to prompt instructions (empty when nothing is rejected, so it concatenates unconditionally).
- Matching is lexical and deterministic: token-overlap score divided by the **smaller** token set (which is what lets a three-word idea match a long decision), with a threshold. A semantic upgrade can sit behind the same consult contract.

## Facts

- The default status everywhere is `rejected` — the rejected set is the primary reason the ledger exists.
- Recording an existing id replaces in place, keeping ledger order stable across a rejected-then-accepted lifecycle.
- The markdown parser reads metadata bullets only before the first body line and silently skips malformed sections — one bad hand-edit cannot sink the file.
- The tool for recording awaits its persistence hook, so a save rejection surfaces as a tool error rather than a silently unsaved ledger. (Currently unused by the product package.)

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
