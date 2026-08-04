The Discord chat surface: a hand-rolled gateway client feeding pure routing rules that act on runs over the control channel (inbound), and a mirror posting a session's settled answers back to the channel that asked (outbound).

## TLDR

- `gateway.ts` — the connection (see spec). `routing.ts` — pure `decideAction(text, snapshot) → action`. `bot.ts` — wiring only, every effect injected. `live-run.ts` — builds the routing snapshot from on-disk run state (a parked gate's options live in the run's event log, so the snapshot reads them through the store). `reply-mirror.ts` — the outbound half (see spec). `rest.ts` — one clamped, threaded message post.
- A chat message reaches a run **exactly the way a dashboard click does** — a control-channel entry — so chat history is not written here: the run itself commits the turn to the conversation file.

## Decisions

- The purity split is the organizing principle: routing has no imports at all, so every rule is unit-testable without a gateway, a daemon, or a run.
- Routing precedence: commands (`!help`/`!status`/`!stop`) → if a gate is parked, try to read the message as an answer → else pass it through as an ordinary message → else start a new run. Answer resolution accepts option numbers, an exact label, or an exact id — and returns nothing rather than guessing; picking the wrong option on someone's behalf is worse than asking again (numbering the rendered options is what makes number-answers possible).
- Toggles are re-read per message / per poll, so turning the bot off needs no daemon restart; nothing in this directory may throw out of the daemon.
- Never act on a bot's message, our own most of all — two bots replying to each other is an unbounded loop that costs real money.

## Facts

- Known MVP limit, marked in code as not-to-be-fixed-here: chat models **one live run per project** and routes to the newest; the real fix is letting the bot list and target runs.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
