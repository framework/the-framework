The Discord chatbot's wiring: take each incoming chat message, decide what it means, and act on the project exactly as a dashboard click would.

## TLDR

- Every decision comes from the pure routing rules; this module only executes the chosen action — answer a parked question, message the live session, start one, or stop it — through the same control channel the dashboard uses, so the session cannot tell the difference.
- Before a message is handed to a session, the session is bound to the channel it came from, so the answer is mirrored back as new instead of being swallowed by the mirror's baseline.
- The chat transcript is not stored here: a routed message reaches the session's committed conversation, which is the durable record.
- Replies are threaded onto the message that asked; the bot can be restricted to one channel, and its on/off preference is re-read per message so toggling needs no restart.
- Never throws — a chat integration that can take the daemon down is worse than one that stays quiet.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
