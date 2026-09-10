Keeps the running totals of what one agent [1] has spent across its turns [2]: the input, output, cache-read and cache-creation tokens each turn reports, summed; the number of turns that reported usage; and the cost in dollars. The cost is absent, not zero, until a turn reports a price, and a turn without a price adds its tokens and leaves the cost where it was: an agent whose coding agent [3] never prices a turn, as Codex on a subscription does not, totals "no price reported" rather than a "$0" that would read as free, while an agent whose turns are priced totals what is known to have been spent. These totals are what this agent spent, not where the account's quota [4] stands, which the coding agent reports separately each turn. Every reading is a snapshot: turns added later do not change a total already read. The totals are what the usage line in `terminal.ts` and the dashboard show.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
