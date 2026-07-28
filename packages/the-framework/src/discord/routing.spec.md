Pure routing for the Discord bot (#680): `decideAction(text, ctx)` maps a message plus a project-state snapshot to a `BotAction`, with no side effects.

## TLDR

- Commands: `!help` (help text), `!status` (what runs now, plus the parked gate rendered), `!stop` (stop the live run).
- A parked gate reads the message as an answer first via `resolvePick`; a live run without a match gets the text as a `message`; no live run means `start` a session in the target project.
- `renderGate` renders a gate as a numbered question so it can be answered by number in chat.
- Every action carries a `reply` string the bot posts back.

## Decisions

- `resolvePick` accepts option numbers (`2`, `1,3` for multi-select) and exact option labels or ids case-insensitively; anything else resolves `undefined` and falls through to an ordinary message — picking the wrong option on someone's behalf is worse than asking again.
- Pure on purpose: every routing rule is unit-testable without a gateway, a daemon, or a run; the side effects live in `bot.ts`.
