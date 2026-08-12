When a chat continues after pausing for tool approval, this executes the tool calls the previous turn left unfinished — honoring the user's approve/reject decisions — so the conversation is well-formed before the model is called again.

## TLDR

- Approved server tools run now and their results are appended; rejected calls get a rejection result; unknown tools or client tools whose browser result never arrived get error results the model can recover from.
- If some calls are still undecided, execution stops there and placeholder results are synthesized for every unresolved call, because some providers reject a conversation where any tool call lacks a result; the next resume strips the placeholders and re-walks with the fresh decisions.
- Calls resolved in an earlier partial resume are skipped, so nothing executes twice.
- The appended results are also handed back so the caller can persist them with the conversation.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
